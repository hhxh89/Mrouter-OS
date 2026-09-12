'use strict';
'require view';
'require fs';
'require rpc';
'require poll';


const DATA =
    '/usr/libexec/mrouter-client-data';

const ACTION =
    '/usr/libexec/mrouter-client-action';


const callDHCPLeases = rpc.declare({
    object: 'luci-rpc',
    method: 'getDHCPLeases',
    expect: { '': {} }
});



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

function s(v) {
    return [
        String(
            v == null || v === ''
                ? '—'
                : v
        )
    ];
}


function bytes(v) {

    v = Number(v) || 0;


    if (v >= 1073741824)
        return (v / 1073741824)
            .toFixed(2) + ' GB';


    if (v >= 1048576)
        return (v / 1048576)
            .toFixed(2) + ' MB';


    if (v >= 1024)
        return (v / 1024)
            .toFixed(1) + ' KB';


    return v + ' B';
}


function speed(v) {

    v = Number(v) || 0;

    let bits = v * 8;


    if (bits >= 1000000000)
        return (bits / 1000000000)
            .toFixed(2) + ' Gbps';


    if (bits >= 1000000)
        return (bits / 1000000)
            .toFixed(2) + ' Mbps';


    if (bits >= 1000)
        return (bits / 1000)
            .toFixed(1) + ' Kbps';


    return Math.round(bits) + ' bps';
}


function leaseTime(v) {

    v = Number(v);


    if (!isFinite(v) || v < 0)
        return 'Unlimited';


    let d = Math.floor(v / 86400);
    let h = Math.floor((v % 86400) / 3600);
    let m = Math.floor((v % 3600) / 60);


    if (d)
        return d + 'd ' + h + 'h';


    if (h)
        return h + 'h ' + m + 'm';


    return m + 'm';
}


function parse(raw) {

    let out = {
        neigh: {},
        bandwidth: {},
        blocked: {},
        reserved: {},
        names: {}
    };


    String(
        (raw && raw.stdout) || ''
    )
    .split(/\r?\n/)
    .forEach(function(line) {

        let p = line.split('|');


        if (p[0] === 'N' && p.length >= 5) {

            out.neigh[
                String(p[2]).toUpperCase()
            ] = {
                ip: p[1],
                state: p[3],
                dev: p[4]
            };
        }


        if (p[0] === 'B' && p.length >= 4) {

            out.bandwidth[
                String(p[1]).toUpperCase()
            ] = {
                rx: Number(p[2]) || 0,
                tx: Number(p[3]) || 0
            };
        }


        if (p[0] === 'X' && p[1]) {

            out.blocked[
                String(p[1]).toUpperCase()
            ] = true;
        }



        if (p[0] === 'H' && p.length >= 3) {
            out.names[String(p[1]).toUpperCase()] = p.slice(2).join('|');
        }

        if (p[0] === 'R' && p.length >= 3) {

            out.reserved[
                String(p[1]).toUpperCase()
            ] = p[2];
        }
    });


    return out;
}


function getData() {

    return Promise.all([
        mrouterBounded(callDHCPLeases(), { dhcp_leases: [] }, 4500),
        mrouterExec(DATA, [ 'snapshot' ], { stdout: '' }, 4500)
    ]);
}


return view.extend({

    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    previous: {},
    previousTime: null,


    build: function(dhcp, aux) {

        let parsed = parse(aux);

        let leases =
            (dhcp.dhcp_leases || []).filter(function(l) {
                return String(l.interface || '').toLowerCase() !== 'iot';
            });

        let leaseByMac = {};


        leases.forEach(function(l) {

            let mac =
                String(l.macaddr || '')
                .toUpperCase();

            if (mac)
                leaseByMac[mac] = l;
        });


        /*
         * Also include currently discovered neighbours
         * even if this VM is not currently the DHCP server.
         */

        Object.keys(parsed.neigh)
        .forEach(function(mac) {

            if (leaseByMac[mac])
                return;


            leases.push({
                hostname: parsed.names[mac] || 'Unknown device',
                ipaddr: parsed.neigh[mac].ip,
                macaddr: mac,
                expires: -1
            });
        });


        let now = Date.now();

        let delta = this.previousTime
            ? Math.max(
                (now - this.previousTime) / 1000,
                .1
            )
            : null;


        let current = {};

        let connected = [];
        let disconnected = [];


        leases.forEach(
            L.bind(function(l) {

                let mac =
                    String(l.macaddr || '')
                    .toUpperCase();


                if (!mac)
                    return;


                let bw =
                    parsed.bandwidth[mac] ||
                    { rx: 0, tx: 0 };


                let prev =
                    this.previous[mac];


                let down = 0;
                let up = 0;


                if (prev && delta) {

                    down = Math.max(
                        0,
                        (bw.rx - prev.rx) /
                        delta
                    );


                    up = Math.max(
                        0,
                        (bw.tx - prev.tx) /
                        delta
                    );
                }


                current[mac] = {
                    rx: bw.rx,
                    tx: bw.tx
                };


                let n =
                    parsed.neigh[mac];


                let online =
                    !!n &&
                    !/^(FAILED|INCOMPLETE)$/i
                        .test(n.state || '');


                let row = {

                    name:
                        (l.hostname && l.hostname !== '*')
                            ? l.hostname
                            : (parsed.names[mac] || 'Unknown device'),

                    ip:
                        l.ipaddr ||
                        (n && n.ip) ||
                        '—',

                    mac: mac,

                    type:
                        'Ethernet',

                    lease:
                        leaseTime(l.expires),

                    down:
                        speed(down),

                    up:
                        speed(up),

                    rx:
                        bytes(bw.rx),

                    tx:
                        bytes(bw.tx),

                    blocked:
                        !!parsed.blocked[mac],

                    reserved:
                        !!parsed.reserved[mac],

                    online:
                        online
                };


                if (online)
                    connected.push(row);
                else
                    disconnected.push(row);

            }, this)
        );


        this.previous = current;
        this.previousTime = now;


        return {
            connected: connected,
            disconnected: disconnected
        };
    },


    toggle: function(
        action,
        row,
        enabled
    ) {

        let args = [
            action,
            row.mac,
            enabled ? '1' : '0',
            row.ip,
            row.name
        ];


        return fs.exec(
            ACTION,
            args
        ).then(function(r) {

            if (!r || r.code !== 0)
                throw new Error(
                    (r && r.stderr) ||
                    'Action failed'
                );

        });
    },


    switchButton: function(
        action,
        row,
        value
    ) {

        let button =
            E('button', {
                'class':
                    'm-toggle ' +
                    (value ? 'on' : ''),

                'title':
                    value
                        ? 'Enabled'
                        : 'Disabled'
            }, [
                E('span', {})
            ]);


        button.addEventListener(
            'click',
            L.bind(function() {

                let wanted =
                    !button.classList
                        .contains('on');


                button.disabled = true;


                this.toggle(
                    action,
                    row,
                    wanted
                )
                .then(function() {

                    button.classList.toggle(
                        'on',
                        wanted
                    );

                })
                .catch(function(err) {

                    ui.addNotification(
                        null,
                        E('p', {},
                            s(err.message)
                        )
                    );

                })
                .finally(function() {

                    button.disabled = false;

                });

            }, this)
        );


        return button;
    },


    table: function(rows, online) {

        if (!rows.length) {

            return E('div', {
                'class': 'm-empty'
            }, s(
                online
                    ? 'No clients are currently visible to Mrouter-OS.'
                    : 'No disconnected clients have an active DHCP lease.'
            ));
        }


        return E('div', {
            'class': 'm-table-scroll'
        }, [

            E('table', {
                'class': 'm-client-table'
            }, [

                E('thead', {}, [
                    E('tr', {}, [
                        E('th', {}, s('Name')),
                        E('th', {}, s('IP + MAC')),
                        E('th', {}, s('Speed')),
                        E('th', {}, s('Traffic')),
                        E('th', {}, s('Lease')),
                        E('th', {}, s('Reserved IP')),
                        E('th', {}, s('Block'))
                    ])
                ]),


                E('tbody', {},
                    rows.map(
                        L.bind(function(row) {

                            return E('tr', {}, [

                                E('td', {}, [

                                    E('div', {
                                        'class':
                                            'm-client-name'
                                    }, s(row.name)),

                                    E('div', {
                                        'class':
                                            online
                                                ? 'm-online-small'
                                                : 'm-offline-small'
                                    }, s(
                                        online
                                            ? 'Online'
                                            : 'Offline'
                                    ))
                                ]),


                                E('td', {}, [

                                    E('div', {
                                        'class':
                                            'm-client-ip'
                                    }, s(row.ip)),

                                    E('div', {
                                        'class':
                                            'm-client-mac'
                                    }, s(row.mac))
                                ]),


                                E('td', {
                                    'class':
                                        'm-speed-cell'
                                }, [
                                    E('div', {},
                                        s('↓ ' + row.down)
                                    ),

                                    E('div', {},
                                        s('↑ ' + row.up)
                                    )
                                ]),


                                E('td', {
                                    'class':
                                        'm-traffic-cell'
                                }, [
                                    E('div', {},
                                        s('↓ ' + row.rx)
                                    ),

                                    E('div', {},
                                        s('↑ ' + row.tx)
                                    )
                                ]),


                                E('td', {},
                                    s(row.lease)
                                ),


                                E('td', {},
                                    this.switchButton(
                                        'reserve',
                                        row,
                                        row.reserved
                                    )
                                ),


                                E('td', {},
                                    this.switchButton(
                                        'block',
                                        row,
                                        row.blocked
                                    )
                                )
                            ]);

                        }, this)
                    )
                )
            ])
        ]);
    },


    render: function(data) {
        let rows = this.build(data[0] || {}, data[1]);
        let count = E('div', { 'class': 'm-count m-count-green' }, s(rows.connected.length + ' online'));
        let onlineTitle = E('h3', {}, s('Online Clients (' + rows.connected.length + ')'));
        let onlineBox = E('div', {}, [ this.table(rows.connected, true) ]);
        let offlineBox = E('div', {}, [ this.table(rows.disconnected, false) ]);

        let root = E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [ E('h2', {}, s('Clients')), E('div', { 'class': 'm-subtitle' }, s('Devices connected to Mrouter-OS')) ]),
                count
            ]),
            E('div', { 'class': 'm-section' }, [ onlineTitle, onlineBox ]),
            E('div', { 'class': 'm-section' }, [
                E('h3', {}, s('Disconnected — Active DHCP Leases')),
                E('div', { 'class': 'm-muted', 'style': 'margin-bottom:14px' }, s('These devices still have an active DHCP lease but are not currently visible on the network.')),
                offlineBox
            ])
        ]);

        poll.add(L.bind(function() {
            return getData().then(L.bind(function(d) {
                let next = this.build(d[0] || {}, d[1]);
                count.textContent = next.connected.length + ' online';
                onlineTitle.textContent = 'Online Clients (' + next.connected.length + ')';
                onlineBox.replaceChildren(this.table(next.connected, true));
                offlineBox.replaceChildren(this.table(next.disconnected, false));
            }, this)).catch(function() {});
        }, this), 5);

        return root;
    },


    load: getData
});
