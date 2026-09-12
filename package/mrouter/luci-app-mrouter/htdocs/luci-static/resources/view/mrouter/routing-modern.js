'use strict';
'require view';
'require fs';

const HELPER = '/usr/libexec/mrouter-advanced';

function tx(v) {
    return [ String(v == null || v === '' ? '—' : v) ];
}

function exec(args) {
    return fs.exec(HELPER, args || []).catch(function() {
        return { stdout: '' };
    });
}

function parse(r) {
    let out = { def: {}, routes: [] };

    String((r && r.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');

        if (p[0] === 'DEFAULT') {
            out.def = { dev: p[1], gw: p[2], src: p[3] };
        }
        else if (p[0] === 'ROUTE') {
            out.routes.push({
                id: p[1],
                iface: p[2],
                target: p[3],
                mask: p[4],
                gw: p[5]
            });
        }
    });

    return out;
}

function routeNode(label, value, active) {
    return E('div', { 'class': 'm-route-node' + (active ? ' active' : '') }, [
        E('span', {}, tx(label)),
        E('strong', {}, tx(value))
    ]);
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    load: function() {
        return exec([ 'snapshot' ]);
    },

    render: function(raw) {
        let state = parse(raw);
        let routes = E('div', { 'class': 'm-simple-list' });

        state.routes.forEach(function(r) {
            let target = r.target || 'Route';
            if (r.mask)
                target += ' / ' + r.mask;

            routes.appendChild(E('div', { 'class': 'm-simple-row' }, [
                E('div', {}, [
                    E('strong', {}, tx(target)),
                    E('span', {}, tx('Via ' + (r.gw || 'interface') + ' • ' + (r.iface || 'auto')))
                ]),
                E('span', { 'class': 'm-state-pill neutral' }, tx('Static'))
            ]));
        });

        if (!state.routes.length) {
            routes.appendChild(E('div', { 'class': 'm-empty' },
                tx('No custom static routes. Most home networks do not need any.')));
        }

        let defaultPath = E('div', { 'class': 'm-route-path' }, [
            routeNode('Your networks', 'LAN / IoT / Guest', false),
            E('i', {}, tx('→')),
            routeNode('Router WAN', state.def.src || 'No WAN address', true),
            E('i', {}, tx('→')),
            routeNode('Gateway', state.def.gw || 'No gateway', false),
            E('i', {}, tx('→')),
            routeNode('Internet', state.def.dev || 'Offline', false)
        ]);

        return E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [
                    E('h2', {}, tx('Routing')),
                    E('div', { 'class': 'm-subtitle' },
                        tx('Where traffic goes, explained in plain language'))
                ]),
                E('a', {
                    'class': 'm-secondary-link-button',
                    'href': L.url('admin/advanced/expert/routes')
                }, tx('Expert Routes'))
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, tx('Default Internet Route')),
                defaultPath,
                E('div', { 'class': 'm-health-strip' }, [
                    E('div', {}, [
                        E('span', {}, tx('Status')),
                        E('strong', {}, tx(state.def.gw ?
                            'Default route is healthy' :
                            'No default route is currently available'))
                    ]),
                    E('span', {
                        'class': 'm-state-pill ' + (state.def.gw ? 'good' : 'bad')
                    }, tx(state.def.gw ? 'Healthy' : 'Offline'))
                ])
            ]),

            E('div', { 'class': 'm-section' }, [
                E('div', { 'class': 'm-section-header' }, [
                    E('div', {}, [
                        E('h3', {}, tx('Traffic Routes')),
                        E('p', { 'class': 'm-muted' },
                            tx('Send selected devices or destinations through WAN or a VPN using VPN Policy Routing.'))
                    ]),
                    E('a', {
                        'class': 'm-ios-button m-service-open',
                        'href': L.url('admin/vpn/policy-routing')
                    }, tx('+ Add Traffic Route'))
                ]),
                E('div', { 'class': 'm-info-card' }, [
                    E('strong', {}, tx('Use this for everyday routing choices')),
                    E('span', {}, tx(
                        'Examples: send a TV through a VPN, keep banking on the normal WAN, ' +
                        'or block traffic if a VPN disconnects.'
                    ))
                ])
            ]),

            E('div', { 'class': 'm-section' }, [
                E('div', { 'class': 'm-section-header' }, [
                    E('div', {}, [
                        E('h3', {}, tx('Static Routes')),
                        E('p', { 'class': 'm-muted' },
                            tx('Only needed when another router or private network lives behind a specific gateway.'))
                    ]),
                    E('a', {
                        'class': 'm-secondary-link-button',
                        'href': L.url('admin/advanced/expert/routes')
                    }, tx('+ Add Static Route'))
                ]),
                routes
            ])
        ]);
    }
});
