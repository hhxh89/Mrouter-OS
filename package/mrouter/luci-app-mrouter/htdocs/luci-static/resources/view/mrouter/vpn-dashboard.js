'use strict';
'require view';
'require fs';


function mrouterBounded(promise, fallback, timeoutMs) {
    return Promise.race([
        Promise.resolve(promise).catch(function() { return fallback; }),
        new Promise(function(resolve) {
            window.setTimeout(function() { resolve(fallback); }, timeoutMs || 4500);
        })
    ]);
}

function mrouterExec(path, args, fallback, timeoutMs) {
    return mrouterBounded(
        fs.exec(path, args || []),
        fallback || { code: 124, stdout: '', stderr: 'Timed out' },
        timeoutMs || 4500
    );
}

function tx(v) {
    return [ String(v == null || v === '' ? '—' : v) ];
}

function parseOpenVPN(r) {
    let out = { configured: false, connected: false, profile: '', remote: '', proto: '', ip: '' };

    String((r && r.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');
        if (p[0] === 'STATUS') {
            out.configured = p[1] === '1';
            out.connected = p[2] === '1';
            out.profile = p[3] || '';
            out.remote = p[4] || '';
            out.proto = p[5] || '';
            out.ip = p[7] || '';
        }
    });

    return out;
}

function parseWG(r) {
    let out = { configured: false, running: false, address: '', clients: 0 };

    String((r && r.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');
        if (p[0] === 'STATUS') {
            out.configured = p[1] === '1';
            out.running = p[2] === '1';
            out.address = p[5] || '';
            out.clients = Number(p[7]) || 0;
        }
    });

    return out;
}

function parseTS(r) {
    let p = String((r && r.stdout) || '').trim().split('|');
    return {
        enabled: p[1] === '1',
        service: p[2] === '1',
        connected: p[3] === '1',
        backend: p[4] || '',
        ip: p[5] || '',
        account: p[6] || ''
    };
}

function parsePolicy(r) {
    let out = { enabled: false, running: false, policies: [] };

    String((r && r.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');

        if (p[0] === 'STATUS') {
            out.enabled = p[1] === '1';
            out.running = p[2] === '1';
        }

        if (p[0] === 'POLICY') {
            out.policies.push({
                id: p[1],
                name: p[2],
                target: p[11] || p[3],
                fail: p[12] || 'block',
                source: p[8] || p[4],
                destination: p[10] || p[5]
            });
        }
    });

    return out;
}

function tunnelCard(icon, name, subtitle, connected, detail, path) {
    return E('div', { 'class': 'm-vpn-tunnel-card' }, [
        E('div', { 'class': 'm-vpn-tunnel-head' }, [
            E('div', { 'class': 'm-vpn-tunnel-title' }, [
                E('i', {}, tx(icon)),
                E('div', {}, [
                    E('strong', {}, tx(name)),
                    E('span', {}, tx(subtitle))
                ])
            ]),
            E('span', {
                'class': connected ? 'm-vpn-state on' : 'm-vpn-state'
            }, tx(connected ? 'Connected' : 'Offline'))
        ]),

        E('div', { 'class': 'm-vpn-tunnel-detail' }, tx(detail)),

        E('div', { 'class': 'm-app-actions' }, [
            E('a', {
                'class': 'm-secondary-link-button',
                'href': L.url(path)
            }, tx('Settings')),
            E('a', {
                'class': 'm-secondary-link-button',
                'href': L.url('admin/vpn/policy-routing')
            }, tx('Use in Policy'))
        ])
    ]);
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    load: function() {
        return Promise.all([
            mrouterExec('/usr/libexec/mrouter-status-openvpn', [], { stdout: '' }, 4500).catch(function() { return { stdout: '' }; }),
            mrouterExec('/usr/libexec/mrouter-status-wireguard', [], { stdout: '' }, 4500).catch(function() { return { stdout: '' }; }),
            mrouterExec('/usr/libexec/mrouter-status-tailscale', [], { stdout: '' }, 4500).catch(function() { return { stdout: '' }; }),
            mrouterExec('/usr/libexec/mrouter-status-policy', [], { stdout: '' }, 4500).catch(function() { return { stdout: '' }; })
        ]);
    },

    render: function(data) {
        let ovpn = parseOpenVPN(data[0]);
        let wg = parseWG(data[1]);
        let ts = parseTS(data[2]);
        let policy = parsePolicy(data[3]);

        let policyList = E('div', { 'class': 'm-vpn-policy-summary' });

        if (!policy.policies.length) {
            policyList.appendChild(E('div', { 'class': 'm-empty' },
                tx('No VPN routing policies yet.')));
        }

        policy.policies.slice(0, 8).forEach(function(p, idx) {
            policyList.appendChild(E('div', { 'class': 'm-vpn-policy-line' }, [
                E('span', { 'class': 'm-policy-priority' }, tx(idx + 1)),
                E('div', {}, [
                    E('strong', {}, tx(p.name)),
                    E('span', {}, tx(
                        (p.source || 'Any source') + ' → ' +
                        (p.destination || 'All destinations') + ' → ' +
                        (p.target || 'WAN')
                    ))
                ]),
                E('i', { 'class': p.fail === 'block' ? 'lock' : '' },
                    tx(p.fail === 'block' ? 'Block on failure' :
                       p.fail === 'other' ? 'VPN failover' : 'WAN fallback'))
            ]));
        });

        return E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [
                    E('h2', {}, tx('VPN')),
                    E('div', { 'class': 'm-subtitle' },
                        tx('Tunnels, routing policies and failover'))
                ]),
                E('span', {
                    'class': 'm-status-pill ' + (!policy.enabled ? '' : (policy.running ? 'm-status-online' : 'm-status-offline'))
                }, tx(!policy.enabled ? 'Policy Disabled' : (policy.running ? 'Policy Active' : 'Policy Error')))
            ]),

            E('div', { 'class': 'm-vpn-tunnel-grid' }, [
                tunnelCard(
                    'O',
                    'OpenVPN',
                    ovpn.profile || 'Client tunnel',
                    ovpn.connected,
                    ovpn.connected ?
                        ((ovpn.remote || 'Remote server') + (ovpn.ip ? ' • ' + ovpn.ip : '')) :
                        (ovpn.configured ? 'Configured but disconnected' : 'No profile imported'),
                    'admin/vpn/openvpn'
                ),

                tunnelCard(
                    'W',
                    'WireGuard',
                    'Remote access server',
                    wg.running,
                    wg.configured ?
                        ((wg.address || '10.14.0.1/24') + ' • ' + wg.clients + ' generated client(s)') :
                        'Not configured',
                    'admin/vpn/wireguard'
                ),

                tunnelCard(
                    'T',
                    'Tailscale',
                    ts.account || 'Tailnet',
                    ts.connected,
                    ts.connected ? (ts.ip || 'Connected') : (ts.backend === 'NeedsLogin' ? 'Running — login required' : (ts.service ? ('Running — ' + (ts.backend || 'not connected')) : 'Stopped')),
                    'admin/vpn/tailscale'
                )
            ]),

            E('div', { 'class': 'm-section' }, [
                E('div', { 'class': 'm-section-header' }, [
                    E('div', {}, [
                        E('h3', {}, tx('Routing Policies')),
                        E('div', { 'class': 'm-muted' },
                            tx('FROM → TO → VIA → IF VPN FAILS'))
                    ]),
                    E('a', {
                        'class': 'm-primary-link-button',
                        'href': L.url('admin/vpn/policy-routing')
                    }, tx('+ Add Policy'))
                ]),
                policyList
            ]),

            E('div', { 'class': 'm-all-other-card' }, [
                E('div', {}, [
                    E('span', {}, tx('ALL OTHER TRAFFIC')),
                    E('strong', {}, tx('Direct Internet')),
                    E('small', {}, tx(
                        'Traffic not matched by a policy continues over WAN. Policies marked Block remain protected when their VPN is unavailable.'
                    ))
                ]),
                E('span', { 'class': 'm-vpn-state on' }, tx('WAN'))
            ])
        ]);
    }
});
