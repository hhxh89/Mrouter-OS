'use strict';
'require view';
'require fs';
'require ui';

const HELPER = '/usr/libexec/mrouter-services';
const TEMPLATES = {
    pihole:          { name: 'Pi-hole',           port: 80,   scheme: 'http',  path: '/admin/' },
    homeassistant:   { name: 'Home Assistant',    port: 8123, scheme: 'http',  path: '/' },
    proxmox:         { name: 'Proxmox',           port: 8006, scheme: 'https', path: '/' },
    immich:          { name: 'Immich',            port: 2283, scheme: 'http',  path: '/' },
    jellyfin:        { name: 'Jellyfin',          port: 8096, scheme: 'http',  path: '/' },
    plex:            { name: 'Plex',              port: 32400,scheme: 'http',  path: '/web/' },
    truenas:         { name: 'TrueNAS',           port: 443,  scheme: 'https', path: '/' },
    synology:        { name: 'Synology',          port: 5001, scheme: 'https', path: '/' },
    openmediavault:  { name: 'OpenMediaVault',    port: 80,   scheme: 'http',  path: '/' },
    portainer:       { name: 'Portainer',         port: 9443, scheme: 'https', path: '/' },
    grafana:         { name: 'Grafana',           port: 3000, scheme: 'http',  path: '/' },
    custom:          { name: 'Custom Service',    port: 80,   scheme: 'http',  path: '/' }
};

function tx(v) { return [String(v == null || v === '' ? '—' : v)]; }
function bounded(p, f, ms) { return Promise.race([Promise.resolve(p).catch(function() { return f; }), new Promise(function(r) { window.setTimeout(function() { r(f); }, ms || 5000); })]); }
function exec(args, fallback) { return bounded(fs.exec(HELPER, args || []), fallback || { stdout: '', stderr: '' }, 6500); }
function parse(raw) {
    let s = { dnsMode: 'mrouter', piholeHost: '', piholePort: '53', services: [] };
    String((raw && raw.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');
        if (p[0] === 'DNS') { s.dnsMode = p[1] || 'mrouter'; s.piholeHost = p[2] || ''; s.piholePort = p[3] || '53'; }
        else if (p[0] === 'SERVICE') s.services.push({ id:p[1], type:p[2], name:p[3], host:p[4], port:p[5], scheme:p[6] });
    });
    return s;
}
function serviceUrl(s) {
    let t = TEMPLATES[s.type] || TEMPLATES.custom;
    return (s.scheme || 'http') + '://' + s.host + ':' + s.port + (t.path || '/');
}
function notify(msg, type) { ui.addNotification(null, E('p', {}, tx(msg)), type || 'info'); }

return view.extend({
    handleSaveApply: null, handleSave: null, handleReset: null,
    load: function() { return exec([ 'status' ]); },
    render: function(raw) {
        let state = parse(raw);
        let cards = E('div', { 'class': 'm-service-grid' });

        function makeCard(s) {
            let status = E('span', { 'class': 'm-state-pill neutral' }, tx('Saved'));
            let test = E('button', { 'type':'button', 'class':'m-secondary-button' }, tx('Test'));
            let open = E('a', { 'class':'m-ios-button m-service-open', 'href':serviceUrl(s), 'target':'_blank', 'rel':'noopener' }, tx('Open'));
            let del = E('button', { 'type':'button', 'class':'m-danger-button' }, tx('Delete'));
            test.addEventListener('click', function() {
                test.disabled = true; status.textContent = 'Testing…';
                exec([ 'test', s.id ]).then(function(r) {
                    let ok = /^TEST\|1\|/.test(String(r.stdout || ''));
                    status.textContent = ok ? 'Online' : 'Unreachable';
                    status.className = 'm-state-pill ' + (ok ? 'good' : 'bad');
                }).finally(function() { test.disabled = false; });
            });
            del.addEventListener('click', function() {
                if (!window.confirm('Delete ' + s.name + ' from Local Services?')) return;
                del.disabled = true;
                exec([ 'delete', s.id ]).then(function(r) {
                    if (r && r.code && r.code !== 0) { del.disabled = false; notify(r.stderr || 'Could not delete service.', 'error'); }
                    else window.location.reload();
                });
            });
            return E('div', { 'class':'m-service-card' }, [
                E('div', { 'class':'m-service-card-head' }, [
                    E('div', {}, [ E('strong', {}, tx(s.name)), E('span', {}, tx((TEMPLATES[s.type] || TEMPLATES.custom).name)) ]),
                    status
                ]),
                E('div', { 'class':'m-service-address' }, tx((s.scheme || 'http') + '://' + s.host + ':' + s.port)),
                E('div', { 'class':'m-inline-actions' }, [ test, open, del ])
            ]);
        }
        if (!state.services.length) cards.appendChild(E('div', { 'class':'m-empty-card' }, tx('No local services have been added yet.')));
        else state.services.forEach(function(s) { cards.appendChild(makeCard(s)); });

        let type = E('select', { 'class':'m-ios-input' });
        Object.keys(TEMPLATES).forEach(function(k) { type.appendChild(E('option', { 'value':k }, tx(TEMPLATES[k].name))); });
        let name = E('input', { 'class':'m-ios-input', 'type':'text', 'value':TEMPLATES.pihole.name, 'placeholder':'Service name' });
        let host = E('input', { 'class':'m-ios-input', 'type':'text', 'placeholder':'192.168.1.10' });
        let port = E('input', { 'class':'m-ios-input', 'type':'number', 'min':'1', 'max':'65535', 'value':String(TEMPLATES.pihole.port) });
        let scheme = E('select', { 'class':'m-ios-input' }, [ E('option', { 'value':'http' }, tx('HTTP')), E('option', { 'value':'https' }, tx('HTTPS')) ]);
        scheme.value = TEMPLATES.pihole.scheme;
        type.addEventListener('change', function() {
            let t = TEMPLATES[type.value] || TEMPLATES.custom;
            name.value = t.name; port.value = t.port; scheme.value = t.scheme;
        });
        let add = E('button', { 'type':'button', 'class':'m-ios-button' }, tx('Add Service'));
        add.addEventListener('click', function() {
            let hv = host.value.trim();
            if (!hv) { notify('Enter the service IP address or hostname.', 'error'); return; }
            try {
                if (/^https?:\/\//i.test(hv)) {
                    let u = new URL(hv);
                    hv = u.hostname;
                    scheme.value = u.protocol === 'https:' ? 'https' : 'http';
                    if (u.port) port.value = u.port;
                }
            } catch (e) { notify('The service URL is not valid.', 'error'); return; }
            add.disabled = true;
            exec([ 'add', type.value, name.value.trim() || TEMPLATES[type.value].name, hv, String(port.value || ''), scheme.value ]).then(function(r) {
                if (r && r.code && r.code !== 0) { add.disabled = false; notify(r.stderr || 'Could not add service.', 'error'); }
                else window.location.reload();
            });
        });

        let phHost = E('input', { 'class':'m-ios-input', 'type':'text', 'value':state.piholeHost || '', 'placeholder':'Pi-hole IP, e.g. 192.168.1.20' });
        let phPort = E('input', { 'class':'m-ios-input', 'type':'number', 'min':'1', 'max':'65535', 'value':state.piholePort || '53' });
        let usePi = E('button', { 'type':'button', 'class':'m-ios-button' }, tx('Use Pi-hole DNS'));
        let useMr = E('button', { 'type':'button', 'class':'m-secondary-button' }, tx('Use Mrouter DNS'));
        usePi.addEventListener('click', function() {
            if (!phHost.value.trim()) { notify('Enter the Pi-hole IP address first.', 'error'); return; }
            if (!window.confirm('Use this Pi-hole as Mrouter\'s upstream DNS? If AdGuard Home is running, it will be disabled.')) return;
            usePi.disabled = true;
            exec([ 'dns-pihole', phHost.value.trim(), String(phPort.value || '53') ]).then(function(r) {
                if (r && r.code && r.code !== 0) { usePi.disabled = false; notify(r.stderr || 'Could not enable Pi-hole DNS.', 'error'); }
                else window.location.reload();
            });
        });
        useMr.addEventListener('click', function() {
            useMr.disabled = true;
            exec([ 'dns-mrouter' ]).then(function(r) {
                if (r && r.code && r.code !== 0) { useMr.disabled = false; notify(r.stderr || 'Could not restore Mrouter DNS.', 'error'); }
                else window.location.reload();
            });
        });

        return E('div', { 'class':'mrouter-page' }, [
            E('div', { 'class':'m-page-title' }, [
                E('div', {}, [ E('h2', {}, tx('Local Services')), E('div', { 'class':'m-subtitle' }, tx('Quick access to the services running on your home network')) ]),
                E('span', { 'class':'m-state-pill good' }, tx(state.services.length + ' saved'))
            ]),
            E('div', { 'class':'m-section' }, [ E('h3', {}, tx('Your Services')), cards ]),
            E('div', { 'class':'m-section' }, [
                E('h3', {}, tx('Add Local Service')),
                E('p', { 'class':'m-muted' }, tx('Choose a template or add a custom web service. Mrouter stores only its local address and does not require cloud access.')),
                E('div', { 'class':'m-service-form' }, [
                    E('label', {}, [ E('span', {}, tx('Type')), type ]),
                    E('label', {}, [ E('span', {}, tx('Name')), name ]),
                    E('label', {}, [ E('span', {}, tx('Host / IP')), host ]),
                    E('label', {}, [ E('span', {}, tx('Port')), port ]),
                    E('label', {}, [ E('span', {}, tx('Protocol')), scheme ])
                ]),
                E('div', { 'class':'m-inline-actions' }, [ add ])
            ]),
            E('div', { 'class':'m-section' }, [
                E('div', { 'class':'m-section-header' }, [
                    E('div', {}, [ E('h3', {}, tx('DNS Provider')), E('p', { 'class':'m-muted' }, tx('Choose the resolver Mrouter sends client DNS queries to.')) ]),
                    E('span', { 'class':'m-state-pill ' + (state.dnsMode === 'pihole' ? 'good' : 'neutral') }, tx(state.dnsMode === 'pihole' ? 'Pi-hole' : 'Mrouter'))
                ]),
                E('div', { 'class':'m-info-card' }, [
                    E('strong', {}, tx('Pi-hole mode is explicit')),
                    E('span', {}, tx('Adding a Pi-hole card does not change DNS. Use the button below only when you want Mrouter to forward DNS to Pi-hole. Make sure Pi-hole does not use this router as its own upstream resolver, otherwise you can create a DNS loop.'))
                ]),
                E('div', { 'class':'m-service-form m-service-form-dns' }, [
                    E('label', {}, [ E('span', {}, tx('Pi-hole host / IP')), phHost ]),
                    E('label', {}, [ E('span', {}, tx('DNS port')), phPort ])
                ]),
                E('div', { 'class':'m-inline-actions' }, [ usePi, useMr ])
            ])
        ]);
    }
});
