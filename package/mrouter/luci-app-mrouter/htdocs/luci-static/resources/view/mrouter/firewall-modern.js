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
    let out = { zones: [], forwards: [] };

    String((r && r.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');

        if (p[0] === 'ZONE') {
            out.zones.push({
                name: p[1],
                input: p[2],
                output: p[3],
                forward: p[4],
                networks: p[5],
                masq: p[6] === '1'
            });
        }
        else if (p[0] === 'FWD') {
            out.forwards.push({ src: p[1], dst: p[2] });
        }
    });

    return out;
}

function forwardingAllowed(src, dst, state) {
    if (src === dst)
        return true;

    return state.forwards.some(function(f) {
        return f.src === src && f.dst === dst;
    });
}

function routerAllowed(src, state) {
    let z = state.zones.find(function(zone) {
        return zone.name === src;
    });

    return !!z && z.input === 'ACCEPT';
}

function matrixCell(ok, detail) {
    return E('div', { 'class': 'm-fw-cell ' + (ok ? 'allow' : 'block') }, [
        E('strong', {}, tx(ok ? 'Allow' : 'Block')),
        E('span', {}, tx(detail))
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
        let localZones = state.zones.map(function(z) { return z.name; })
            .filter(function(name) { return name && name !== 'wan'; });

        if (!localZones.length)
            localZones = [ 'lan' ];

        let columns = [ 'Internet' ]
            .concat(localZones.filter(function(name) { return name !== 'lan'; }))
            .concat([ 'Router' ]);

        let matrix = E('div', { 'class': 'm-fw-matrix' });
        matrix.appendChild(E('div', { 'class': 'm-fw-corner' }, tx('FROM ↓  TO →')));

        columns.forEach(function(name) {
            matrix.appendChild(E('div', { 'class': 'm-fw-col-head' }, tx(name)));
        });

        localZones.forEach(function(src) {
            matrix.appendChild(E('div', { 'class': 'm-fw-row-head' }, tx(src.toUpperCase())));

            columns.forEach(function(dst) {
                if (dst === 'Internet') {
                    matrix.appendChild(matrixCell(
                        forwardingAllowed(src, 'wan', state),
                        src + ' → WAN'
                    ));
                }
                else if (dst === 'Router') {
                    matrix.appendChild(matrixCell(
                        routerAllowed(src, state),
                        src + ' → Router'
                    ));
                }
                else {
                    matrix.appendChild(matrixCell(
                        forwardingAllowed(src, dst, state),
                        src + ' → ' + dst
                    ));
                }
            });
        });

        let zones = E('div', { 'class': 'm-simple-list' });
        state.zones.forEach(function(z) {
            zones.appendChild(E('div', { 'class': 'm-simple-row' }, [
                E('div', {}, [
                    E('strong', {}, tx(z.name)),
                    E('span', {}, tx((z.networks || 'No networks') + (z.masq ? ' • NAT' : '')))
                ]),
                E('span', {
                    'class': 'm-state-pill ' + (z.name === 'wan' ? 'warn' : 'neutral')
                }, tx('Input ' + z.input + ' • Forward ' + z.forward))
            ]));
        });

        if (!state.zones.length)
            zones.appendChild(E('div', { 'class': 'm-empty' }, tx('No firewall zones were found.')));

        return E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [
                    E('h2', {}, tx('Firewall')),
                    E('div', { 'class': 'm-subtitle' },
                        tx('See which networks can talk to each other at a glance'))
                ]),
                E('a', {
                    'class': 'm-secondary-link-button',
                    'href': L.url('admin/advanced/expert/firewall')
                }, tx('Expert Rules'))
            ]),

            E('div', { 'class': 'm-info-card' }, [
                E('strong', {}, tx('Zone-based view')),
                E('span', {}, tx(
                    'Green means forwarding is allowed by the current OpenWrt zone configuration. ' +
                    'Red means there is no forwarding path. Router access follows each zone input policy.'
                ))
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, tx('Network Access Matrix')),
                matrix
            ]),

            E('div', { 'class': 'm-section' }, [
                E('div', { 'class': 'm-section-header' }, [
                    E('div', {}, [
                        E('h3', {}, tx('Security Zones')),
                        E('p', { 'class': 'm-muted' },
                            tx('Mrouter keeps nftables and OpenWrt firewall4 underneath.'))
                    ]),
                    E('a', {
                        'class': 'm-ios-button m-service-open',
                        'href': L.url('admin/advanced/expert/firewall')
                    }, tx('+ Add Rule'))
                ]),
                zones
            ])
        ]);
    }
});
