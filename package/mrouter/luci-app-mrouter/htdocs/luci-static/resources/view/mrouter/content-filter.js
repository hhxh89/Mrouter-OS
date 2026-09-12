'use strict';
'require view';
'require fs';
'require ui';

const HELPER = '/usr/libexec/mrouter-content-filter';
function bounded(p, f, ms) { return Promise.race([Promise.resolve(p).catch(function() { return f; }), new Promise(function(r) { window.setTimeout(function() { r(f); }, ms || 4500); })]); }
function exec(path, args, f) { return bounded(fs.exec(path, args || []), f || { stdout: '', stderr: '' }, 4500); }
function tx(v) { return [String(v == null || v === '' ? '—' : v)]; }
function toggle(on) { return E('button', { 'type': 'button', 'class': 'm-toggle m-toggle-small' + (on ? ' on' : '') }, [E('span', {})]); }
function parse(r) {
    let o = { enabled: false, force: false, dot: false, domains: [], allows: [], ips: [], dc: 0, ac: 0, ic: 0 };
    String((r && r.stdout) || '').split(/\r?\n/).forEach(function(l) {
        let p = l.split('|');
        if (p[0] === 'STATUS') { o.enabled = p[1] === '1'; o.force = p[2] === '1'; o.dot = p[3] === '1'; o.dc = +(p[4] || 0); o.ic = +(p[5] || 0); o.ac = +(p[6] || 0); }
        else if (p[0] === 'DOMAIN') o.domains.push(p[1]);
        else if (p[0] === 'ALLOW') o.allows.push(p[1]);
        else if (p[0] === 'IP') o.ips.push(p[1]);
    });
    return o;
}

const PRESETS = {
    'Social': {
        'TikTok': ['tiktok.com','tiktokv.com','tiktokcdn.com','byteoversea.com','musical.ly'],
        'Instagram': ['instagram.com','cdninstagram.com'],
        'Facebook': ['facebook.com','facebook.net','fbcdn.net','fb.com','fbsbx.com'],
        'Messenger': ['messenger.com','facebook.com','fbcdn.net'],
        'X / Twitter': ['x.com','twitter.com','t.co','twimg.com'],
        'Snapchat': ['snapchat.com','sc-cdn.net','sc-static.net'],
        'Reddit': ['reddit.com','redd.it','redditstatic.com','redditmedia.com'],
        'Pinterest': ['pinterest.com','pinimg.com'],
        'WhatsApp': ['whatsapp.com','whatsapp.net'],
        'Telegram': ['telegram.org','telegram.me','t.me'],
        'Discord': ['discord.com','discord.gg','discordapp.com','discordapp.net','discordcdn.com']
    },
    'Streaming': {
        'YouTube': ['youtube.com','youtu.be','googlevideo.com','ytimg.com','youtube-nocookie.com'],
        'Netflix': ['netflix.com','nflxvideo.net','nflximg.net','nflxso.net','nflxext.com'],
        'Twitch': ['twitch.tv','ttvnw.net','jtvnw.net'],
        'Spotify': ['spotify.com','scdn.co','spotifycdn.com'],
        'Disney+': ['disneyplus.com','disney-plus.net','dssott.com','bamgrid.com'],
        'Prime Video': ['primevideo.com','amazonvideo.com','aiv-cdn.net']
    },
    'Gaming': {
        'Roblox': ['roblox.com','rbxcdn.com'],
        'Steam': ['steampowered.com','steamcommunity.com','steamstatic.com','steamcontent.com','steamserver.net'],
        'Epic Games': ['epicgames.com','epicgames.dev'],
        'Fortnite': ['fortnite.com','epicgames.com','epicgames.dev'],
        'Xbox': ['xbox.com','xboxlive.com','xboxservices.com'],
        'PlayStation': ['playstation.com','playstation.net','sonyentertainmentnetwork.com'],
        'Minecraft': ['minecraft.net','mojang.com']
    }
};

function domainSet(value) {
    return new Set(String(value || '').split(/[\s,]+/).filter(Boolean).map(function(x) { return x.toLowerCase(); }));
}

return view.extend({
    handleSaveApply: null, handleSave: null, handleReset: null,
    load: function() { return exec('/usr/libexec/mrouter-status-content-filter', [], { stdout: '' }); },
    render: function(raw) {
        let st = parse(raw), master = toggle(st.enabled), force = toggle(st.force), dot = toggle(st.dot);
        let domains = E('textarea', { 'class': 'm-ios-input m-filter-textarea', 'rows': '10', 'placeholder': 'example.com\nads.example.net' }, tx(st.domains.join('\n')));
        let allows = E('textarea', { 'class': 'm-ios-input m-filter-textarea', 'rows': '7', 'placeholder': 'school.example.com\nrequired-service.example' }, tx(st.allows.join('\n')));
        let ips = E('textarea', { 'class': 'm-ios-input m-filter-textarea', 'rows': '8', 'placeholder': '203.0.113.10\n2001:db8::/32' }, tx(st.ips.join('\n')));
        let presetButtons = [];

        let presetGroups = E('div', { 'class': 'm-preset-groups' }, Object.keys(PRESETS).map(function(group) {
            let grid = E('div', { 'class': 'm-preset-grid' });
            Object.keys(PRESETS[group]).forEach(function(label) {
                let b = E('button', { 'type': 'button', 'class': 'm-preset-chip' }, tx(label));
                b.dataset.group = group;
                b.dataset.label = label;
                b.addEventListener('click', function() {
                    let have = domainSet(domains.value);
                    let list = PRESETS[group][label];
                    let active = list.every(function(d) { return have.has(d); });
                    list.forEach(function(d) { if (active) have.delete(d); else have.add(d); });
                    domains.value = Array.from(have).sort().join('\n');
                    refreshPresets();
                });
                presetButtons.push(b);
                grid.appendChild(b);
            });
            return E('div', { 'class': 'm-preset-group' }, [ E('strong', {}, tx(group)), grid ]);
        }));

        function refreshPresets() {
            let have = domainSet(domains.value);
            presetButtons.forEach(function(b) {
                let list = PRESETS[b.dataset.group][b.dataset.label];
                b.classList.toggle('active', list.every(function(d) { return have.has(d); }));
            });
        }
        domains.addEventListener('input', refreshPresets);
        refreshPresets();

        function setToggle(el) { el.addEventListener('click', function() { el.classList.toggle('on'); }); }
        setToggle(master); setToggle(force); setToggle(dot);

        let save = E('button', { 'type': 'button', 'class': 'm-ios-button' }, tx('Apply Filter'));
        save.addEventListener('click', function() {
            save.disabled = true;
            let d = String(domains.value || '').replace(/[\r\n\t ]+/g, ',');
            let i = String(ips.value || '').replace(/[\r\n\t ]+/g, ',');
            let a = String(allows.value || '').replace(/[\r\n\t ]+/g, ',');
            exec(HELPER, [ 'save', master.classList.contains('on') ? '1' : '0', force.classList.contains('on') ? '1' : '0', dot.classList.contains('on') ? '1' : '0', d, i, a ]).then(function(r) {
                if (r && r.code && r.code !== 0) {
                    save.disabled = false;
                    ui.addNotification(null, E('p', {}, tx(r.stderr || 'Could not apply filter.')), 'error');
                }
                else window.location.reload();
            });
        });

        return E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [ E('h2', {}, tx('Content Filter')), E('div', { 'class': 'm-subtitle' }, tx('Simple local blocking with DNS-bypass protection')) ]),
                E('span', { 'class': 'm-state-pill ' + (st.enabled ? 'good' : 'neutral') }, tx(st.enabled ? 'Enabled' : 'Disabled'))
            ]),
            E('div', { 'class': 'm-stats-grid' }, [
                E('div', { 'class': 'm-stat-card' }, [ E('span', {}, tx('Blocked domains')), E('strong', {}, tx(st.dc || 0)) ]),
                E('div', { 'class': 'm-stat-card' }, [ E('span', {}, tx('Allowed domains')), E('strong', {}, tx(st.ac || 0)) ]),
                E('div', { 'class': 'm-stat-card' }, [ E('span', {}, tx('Blocked IP/CIDR')), E('strong', {}, tx(st.ic || 0)) ]),
                E('div', { 'class': 'm-stat-card' }, [ E('span', {}, tx('Forced DNS')), E('strong', {}, tx(st.force ? 'On' : 'Off')) ])
            ]),
            E('div', { 'class': 'm-section' }, [
                E('div', { 'class': 'm-setting-row' }, [ E('div', {}, [ E('strong', {}, tx('Enable Content Filter')), E('span', {}, tx('Apply the custom domain and IP block lists below.')) ]), master ]),
                E('div', { 'class': 'm-setting-row' }, [ E('div', {}, [ E('strong', {}, tx('Force router DNS')), E('span', {}, tx('Prevent clients from bypassing the selected router DNS with another port-53 resolver.')) ]), force ]),
                E('div', { 'class': 'm-setting-row' }, [ E('div', {}, [ E('strong', {}, tx('Block external DNS-over-TLS')), E('span', {}, tx('When forced DNS is enabled, block client access to external port 853.')) ]), dot ])
            ]),
            E('div', { 'class': 'm-section' }, [
                E('h3', {}, tx('Quick Blocks')),
                E('p', { 'class': 'm-muted' }, tx('Domain-based presets. Blue means the preset is currently included. These are not DPI/application signatures.')),
                presetGroups
            ]),
            E('div', { 'class': 'm-filter-grid' }, [
                E('div', { 'class': 'm-section' }, [ E('h3', {}, tx('Blocked Domains')), E('p', { 'class': 'm-muted' }, tx('One domain per line.')), domains ]),
                E('div', { 'class': 'm-section' }, [ E('h3', {}, tx('Allow List')), E('p', { 'class': 'm-muted' }, tx('Exact domains here override matching Mrouter custom blocks. They do not override third-party AdGuard lists.')), allows ])
            ]),
            E('div', { 'class': 'm-section' }, [ E('h3', {}, tx('Blocked IP / CIDR')), E('p', { 'class': 'm-muted' }, tx('IPv4 or IPv6 addresses and CIDR ranges. These are blocked in the forwarding path.')), ips ]),
            E('div', { 'class': 'm-inline-actions' }, [ save ]),
            E('div', { 'class': 'm-info-card' }, [
                E('strong', {}, tx('Maintained filtering')),
                E('span', {}, [ document.createTextNode('Use '), E('a', { 'href': L.url('admin/services/adguardhome') }, tx('AdGuard Home')), document.createTextNode(' for maintained malware, adult and large community lists. Use this page for predictable local rules and quick service blocks.') ])
            ])
        ]);
    }
});
