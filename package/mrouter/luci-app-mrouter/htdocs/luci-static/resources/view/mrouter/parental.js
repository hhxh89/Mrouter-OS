'use strict';
'require view';
'require fs';
'require rpc';
'require ui';

const HELPER = '/usr/libexec/mrouter-parental';
const CLIENT_HELPER = '/usr/libexec/mrouter-client-data';
const getLeases = rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases', expect: { '': {} } });

function bounded(p, fallback, ms) {
    return Promise.race([
        Promise.resolve(p).catch(function() { return fallback; }),
        new Promise(function(resolve) { window.setTimeout(function() { resolve(fallback); }, ms || 4500); })
    ]);
}
function exec(path, args, fallback) { return bounded(fs.exec(path, args || []), fallback || { stdout: '', stderr: '' }, 4500); }
function tx(v) { return [String(v == null || v === '' ? '—' : v)]; }
function toggle(on, cls) { return E('button', { 'type':'button', 'class':'m-toggle ' + (cls || 'm-toggle-small') + (on ? ' on' : '') }, [E('span', {})]); }

function parse(raw) {
    let out = { enabled:false, count:0, active:0, profiles:[] };
    String((raw && raw.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');
        if (p[0] === 'STATUS') {
            out.enabled = p[1] === '1'; out.count = +(p[2] || 0); out.active = +(p[3] || 0);
        }
        else if (p[0] === 'PROFILE') {
            out.profiles.push({ id:p[1], name:p[2], enabled:p[3]==='1', paused:p[4]==='1', days:p[5]||'', start:p[6]||'21:00', end:p[7]||'07:00', macs:(p[8]||'').split(',').filter(Boolean), active:p[9]==='1' });
        }
    });
    return out;
}

function clients(dhcp, raw) {
    let map = {};
    (dhcp.dhcp_leases || []).forEach(function(l) {
        let m = String(l.macaddr || '').toUpperCase(); if (!m) return;
        map[m] = { mac:m, ip:l.ipaddr||'', name:(l.hostname && l.hostname !== '*') ? l.hostname : (l.ipaddr || 'Unknown device') };
    });
    let names = {};
    String((raw && raw.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p=line.split('|');
        if (p[0] === 'H' && p.length >= 3) { names[String(p[1]||'').toUpperCase()] = p.slice(2).join('|'); return; }
        if (p[0] !== 'N' || p.length < 3) return;
        let m=String(p[2]||'').toUpperCase(); if (!m) return;
        if (!map[m]) map[m]={ mac:m, ip:p[1]||'', name:'Unknown device' };
    });
    Object.keys(names).forEach(function(m){ if (map[m] && (!map[m].name || map[m].name === 'Unknown device' || map[m].name === map[m].ip)) map[m].name=names[m]; });
    return Object.keys(map).sort().map(function(k){ return map[k]; });
}

function dayLabel(d) { return ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d] || d; }
function scheduleText(p) {
    let ds = p.days.split(',').filter(Boolean).map(function(x){ return dayLabel(+x); }).join(', ');
    return (ds || 'No days') + ' • ' + p.start + '–' + p.end;
}

return view.extend({
    handleSaveApply:null, handleSave:null, handleReset:null,
    load:function() {
        return Promise.all([
            exec('/usr/libexec/mrouter-status-parental', [], {stdout:''}),
            bounded(getLeases(), {dhcp_leases:[]}, 4500),
            exec(CLIENT_HELPER, ['snapshot'], {stdout:''})
        ]);
    },
    render:function(data) {
        let st=parse(data[0]), allClients=clients(data[1]||{}, data[2]);
        let selected=new Set(), chosenDays=new Set([1,2,3,4,5,6,7]), editing='new';

        let master=toggle(st.enabled,'m-toggle-large');
        master.addEventListener('click', function(){
            let v=!master.classList.contains('on'); master.disabled=true;
            exec(HELPER,['enable',v?'1':'0']).then(function(){ window.location.reload(); });
        });

        let name=E('input',{'class':'m-ios-input m-wide-input','type':'text','placeholder':'e.g. Children'});
        let start=E('input',{'class':'m-ios-input','type':'time','value':'21:00'});
        let end=E('input',{'class':'m-ios-input','type':'time','value':'07:00'});
        let picker=E('div',{'class':'m-parental-client-grid'});
        let dayRow=E('div',{'class':'m-day-picker'});

        function rebuildClients() {
            picker.innerHTML='';
            allClients.forEach(function(c){
                let b=E('button',{'type':'button','class':'m-client-chip'+(selected.has(c.mac)?' selected':'')},[
                    E('strong',{},tx(c.name)), E('span',{},tx(c.ip+' • '+c.mac))
                ]);
                b.addEventListener('click',function(){ selected.has(c.mac)?selected.delete(c.mac):selected.add(c.mac); rebuildClients(); });
                picker.appendChild(b);
            });
            if (!allClients.length) picker.appendChild(E('div',{'class':'m-empty-state'},tx('No DHCP/neighbor clients discovered yet.')));
        }
        function rebuildDays() {
            dayRow.innerHTML='';
            for (let d=1; d<=7; d++) {
                let b=E('button',{'type':'button','class':'m-day-button'+(chosenDays.has(d)?' selected':'')},tx(dayLabel(d)));
                b.addEventListener('click',(function(day){ return function(){ chosenDays.has(day)?chosenDays.delete(day):chosenDays.add(day); rebuildDays(); }; })(d));
                dayRow.appendChild(b);
            }
        }
        function resetEditor() {
            editing='new'; name.value=''; start.value='21:00'; end.value='07:00'; selected=new Set(); chosenDays=new Set([1,2,3,4,5,6,7]); rebuildClients(); rebuildDays();
            saveBtn.textContent='Create Profile'; cancelBtn.style.display='none';
        }
        function editProfile(p) {
            editing=p.id; name.value=p.name; start.value=p.start; end.value=p.end; selected=new Set(p.macs); chosenDays=new Set(p.days.split(',').filter(Boolean).map(Number)); rebuildClients(); rebuildDays();
            saveBtn.textContent='Save Changes'; cancelBtn.style.display='inline-flex';
            editor.scrollIntoView({behavior:'smooth',block:'start'});
        }

        let saveBtn=E('button',{'type':'button','class':'m-ios-button'},tx('Create Profile'));
        let cancelBtn=E('button',{'type':'button','class':'m-secondary-button','style':'display:none'},tx('Cancel'));
        cancelBtn.addEventListener('click',resetEditor);
        saveBtn.addEventListener('click',function(){
            let n=String(name.value||'').trim();
            if (!n) { ui.addNotification(null,E('p',{},tx('Enter a profile name.')),'warning'); return; }
            if (!selected.size) { ui.addNotification(null,E('p',{},tx('Select at least one device.')),'warning'); return; }
            if (!chosenDays.size) { ui.addNotification(null,E('p',{},tx('Select at least one bedtime day.')),'warning'); return; }
            saveBtn.disabled=true;
            let days=Array.from(chosenDays).sort().join(','), macs=Array.from(selected).join(',');
            exec(HELPER,['save',editing,n,'1',macs,days,start.value||'21:00',end.value||'07:00']).then(function(r){
                if (r && r.code && r.code !== 0) { saveBtn.disabled=false; ui.addNotification(null,E('p',{},tx(r.stderr||'Could not save profile.')),'error'); }
                else window.location.reload();
            });
        });

        rebuildClients(); rebuildDays();

        let list=E('div',{'class':'m-parental-profiles'});
        if (!st.profiles.length) list.appendChild(E('div',{'class':'m-empty-state'},tx('No family profiles yet. Create one below.')));
        st.profiles.forEach(function(p){
            let pause=E('button',{'type':'button','class':p.paused?'m-ios-button':'m-secondary-button'},tx(p.paused?'Resume Internet':'Pause Internet'));
            pause.addEventListener('click',function(){ pause.disabled=true; exec(HELPER,['pause',p.id,p.paused?'0':'1']).then(function(){window.location.reload();}); });
            let edit=E('button',{'type':'button','class':'m-secondary-button'},tx('Edit'));
            edit.addEventListener('click',function(){editProfile(p);});
            let del=E('button',{'type':'button','class':'m-danger-button'},tx('Delete'));
            del.addEventListener('click',function(){ if (!confirm('Delete '+p.name+'?')) return; del.disabled=true; exec(HELPER,['delete',p.id]).then(function(){window.location.reload();}); });
            list.appendChild(E('div',{'class':'m-parental-profile'},[
                E('div',{'class':'m-parental-profile-main'},[
                    E('div',{},[E('strong',{},tx(p.name)),E('span',{},tx(p.macs.length+' device'+(p.macs.length===1?'':'s')+' • '+scheduleText(p)))]),
                    E('span',{'class':'m-state-pill '+(p.active?'bad':'good')},tx(p.paused?'Paused now':(p.active?'Bedtime active':'Ready')))
                ]),
                E('div',{'class':'m-inline-actions'},[pause,edit,del])
            ]));
        });

        let editor=E('div',{'class':'m-section'},[
            E('div',{'class':'m-section-header'},[E('div',{},[E('h3',{},tx('Family Profile')),E('p',{'class':'m-muted'},tx('Choose devices and the bedtime period when forwarded Internet traffic is blocked. Overnight schedules are supported.'))])]),
            E('div',{'class':'m-form-grid'},[
                E('label',{'class':'m-field'},[E('span',{},tx('Profile name')),name]),
                E('label',{'class':'m-field'},[E('span',{},tx('Bedtime starts')),start]),
                E('label',{'class':'m-field'},[E('span',{},tx('Bedtime ends')),end])
            ]),
            E('div',{'class':'m-field-block'},[E('span',{'class':'m-field-label'},tx('Days')),dayRow]),
            E('div',{'class':'m-field-block'},[E('span',{'class':'m-field-label'},tx('Devices')),picker]),
            E('div',{'class':'m-inline-actions'},[saveBtn,cancelBtn])
        ]);

        return E('div',{'class':'mrouter-page'},[
            E('div',{'class':'m-page-title'},[
                E('div',{},[E('h2',{},tx('Parental Control')),E('div',{'class':'m-subtitle'},tx('Family profiles, bedtime schedules and one-tap Internet pause'))]),
                E('span',{'class':'m-state-pill '+(st.active?'warn':(st.enabled?'good':'neutral'))},tx(st.enabled?(st.active?st.active+' active':'Enabled'):'Disabled'))
            ]),
            E('div',{'class':'m-hero-card m-parental-hero'},[
                E('div',{},[E('h3',{},tx('Family Protection')),E('p',{},tx('Schedules are enforced locally with nftables. The router does not need a cloud account.'))]),
                E('div',{'class':'m-app-control-row'},[E('span',{},tx('Enable parental controls')),master])
            ]),
            E('div',{'class':'m-stats-grid'},[
                E('div',{'class':'m-stat-card'},[E('span',{},tx('Profiles')),E('strong',{},tx(st.count))]),
                E('div',{'class':'m-stat-card'},[E('span',{},tx('Active blocks')),E('strong',{},tx(st.active))]),
                E('div',{'class':'m-stat-card'},[E('span',{},tx('Enforcement')),E('strong',{},tx('Local nftables'))]),
                E('div',{'class':'m-stat-card'},[E('span',{},tx('Cloud account')),E('strong',{},tx('Not required'))])
            ]),
            E('div',{'class':'m-section'},[E('div',{'class':'m-section-header'},[E('h3',{},tx('Profiles'))]),list]),
            editor,
            E('div',{'class':'m-info-card'},[
                E('strong',{},tx('Content filtering is separate')),E('span',{},tx('Use Protection → Content Filter for forced DNS, custom blocked domains/IP ranges and DNS-bypass protection. DPI remains optional in the stable image.'))
            ])
        ]);
    }
});
