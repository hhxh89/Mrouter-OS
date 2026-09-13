'use strict';
'require view';
'require fs';
'require rpc';
'require poll';
'require ui';

const DATA = '/usr/libexec/mrouter-client-data';
const ACTION = '/usr/libexec/mrouter-client-action';
const META = '/usr/libexec/mrouter-clients';

const leases = rpc.declare({
    object: 'luci-rpc',
    method: 'getDHCPLeases',
    expect: { '': {} }
});

function t(v) {
    return [String(v == null || v === '' ? '—' : v)];
}

function run(path, args) {
    return fs.exec(path, args || []).catch(function(e) {
        return { code: 1, stdout: '', stderr: String(e) };
    });
}

function fmt(v) {
    v = Number(v) || 0;
    if (v >= 1073741824) return (v / 1073741824).toFixed(2) + ' GB';
    if (v >= 1048576) return (v / 1048576).toFixed(2) + ' MB';
    if (v >= 1024) return (v / 1024).toFixed(1) + ' KB';
    return v + ' B';
}

function parseAux(r) {
    let o = { n: {}, b: {}, x: {}, res: {}, h: {}, wifi: {} };

    String(r.stdout || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');
        let mac = String(p[1] || '').toUpperCase();

        if (p[0] === 'N')
            o.n[String(p[2] || '').toUpperCase()] = { ip: p[1], state: p[3], dev: p[4] };
        else if (p[0] === 'B')
            o.b[mac] = { rx: +p[2] || 0, tx: +p[3] || 0 };
        else if (p[0] === 'X')
            o.x[mac] = 1;
        else if (p[0] === 'R')
            o.res[mac] = p[2];
        else if (p[0] === 'H')
            o.h[mac] = p.slice(2).join('|');
        else if (p[0] === 'W')
            o.wifi[mac] = p[2] || 'Wi-Fi';
    });

    return o;
}

function parseMeta(r) {
    let o = { quarantine: false, devices: {}, groups: [] };

    String(r.stdout || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');

        if (p[0] === 'STATUS')
            o.quarantine = p[1] === '1';
        else if (p[0] === 'DEVICE')
            o.devices[String(p[2] || '').toUpperCase()] = {
                id: p[1],
                name: p[3],
                group: p[4]
            };
        else if (p[0] === 'GROUP')
            o.groups.push({ id: p[1], name: p[2], macs: p[3] || '' });
    });

    return o;
}

function build(dhcp, auxResult, metaResult) {
    let aux = parseAux(auxResult);
    let meta = parseMeta(metaResult);
    let map = {};

    (dhcp.dhcp_leases || []).forEach(function(lease) {
        let mac = String(lease.macaddr || '').toUpperCase();
        if (!mac) return;

        map[mac] = {
            mac: mac,
            ip: lease.ipaddr || '',
            name: (lease.hostname && lease.hostname !== '*') ? lease.hostname : '',
            lease: lease.expires
        };
    });

    Object.keys(aux.n).forEach(function(mac) {
        if (!map[mac])
            map[mac] = { mac: mac, ip: aux.n[mac].ip, name: '', lease: -1 };
    });

    let rows = Object.keys(map).map(function(mac) {
        let r = map[mac];
        let md = meta.devices[mac] || {};
        let n = aux.n[mac];
        let bw = aux.b[mac] || {};

        return {
            mac: mac,
            ip: r.ip || (n && n.ip) || '',
            name: md.name || r.name || aux.h[mac] || 'Unknown device',
            group: md.group || '',
            type: aux.wifi[mac] ? ('Wi-Fi · ' + aux.wifi[mac]) : ((n && n.dev) || 'Ethernet'),
            online: !!n && !/FAILED|INCOMPLETE/i.test(n.state || ''),
            rx: bw.rx || 0,
            tx: bw.tx || 0,
            blocked: !!aux.x[mac],
            reserved: aux.res[mac] || ''
        };
    });

    rows.sort(function(a, b) {
        return (b.online - a.online) || a.name.localeCompare(b.name);
    });

    return { rows: rows, meta: meta };
}

function buttonToggle(on, label, cb) {
    let b = E('button', {
        'class': 'm-toggle m-toggle-small' + (on ? ' on' : ''),
        'type': 'button',
        'title': label
    }, [E('span', {})]);

    b.onclick = function() { cb(b); };
    return b;
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    load: function() {
        return Promise.all([
            leases().catch(function() { return { dhcp_leases: [] }; }),
            run(DATA, ['snapshot']),
            run(META, ['status'])
        ]);
    },

    render: function(data) {
        let state = build(data[0] || {}, data[1], data[2]);
        let search = E('input', {
            'class': 'm-ios-input',
            'placeholder': 'Search name, IP, MAC, group…'
        });
        let filter = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': 'all' }, t('All clients')),
            E('option', { 'value': 'online' }, t('Online')),
            E('option', { 'value': 'wifi' }, t('Wi-Fi')),
            E('option', { 'value': 'blocked' }, t('Blocked'))
        ]);
        let body = E('div');

        let quarantine = buttonToggle(
            state.meta.quarantine,
            'Quarantine new LAN devices',
            function(b) {
                b.disabled = true;
                let enable = !b.classList.contains('on');

                run(META, ['quarantine', enable ? '1' : '0']).then(function(r) {
                    if (r.code) {
                        ui.addNotification(null, E('p', {}, t(r.stderr || 'Action failed')), 'error');
                    }
                    else {
                        b.classList.toggle('on', enable);
                        ui.addNotification(
                            null,
                            E('p', {}, t(enable
                                ? 'New LAN devices will be quarantined until unblocked.'
                                : 'Automatic quarantine disabled.')),
                            'info'
                        );
                    }
                }).finally(function() {
                    b.disabled = false;
                });
            }
        );

        function action(row, kind, on) {
            return run(ACTION, [kind, row.mac, on ? '1' : '0', row.ip, row.name, 'lan'])
                .then(function(r) {
                    if (r.code)
                        throw new Error(r.stderr || r.stdout || 'Action failed');
                });
        }

        function draw() {
            let term = search.value.trim().toLowerCase();
            let selectedFilter = filter.value;

            let rows = state.rows.filter(function(r) {
                let match = !term || [r.name, r.ip, r.mac, r.group, r.type]
                    .join(' ')
                    .toLowerCase()
                    .includes(term);

                if (!match) return false;
                if (selectedFilter === 'online' && !r.online) return false;
                if (selectedFilter === 'wifi' && !/^Wi-Fi/.test(r.type)) return false;
                if (selectedFilter === 'blocked' && !r.blocked) return false;
                return true;
            });

            let tableRows = rows.map(function(r) {
                let reserve = buttonToggle(
                    !!r.reserved,
                    'Reserve current IP',
                    function(b) {
                        let enable = !b.classList.contains('on');
                        b.disabled = true;

                        action(r, 'reserve', enable).then(function() {
                            r.reserved = enable ? r.ip : '';
                            b.classList.toggle('on', enable);
                        }).catch(function(e) {
                            ui.addNotification(null, E('p', {}, t(e.message)), 'error');
                        }).finally(function() {
                            b.disabled = false;
                        });
                    }
                );

                let block = buttonToggle(
                    r.blocked,
                    'Block client',
                    function(b) {
                        let enable = !b.classList.contains('on');
                        b.disabled = true;

                        action(r, 'block', enable).then(function() {
                            r.blocked = enable;
                            b.classList.toggle('on', enable);
                        }).catch(function(e) {
                            ui.addNotification(null, E('p', {}, t(e.message)), 'error');
                        }).finally(function() {
                            b.disabled = false;
                        });
                    }
                );

                let edit = E('button', {
                    'class': 'm-secondary-button',
                    'type': 'button'
                }, t('Name / Group'));

                edit.onclick = function() {
                    let name = prompt('Friendly name', r.name);
                    if (name === null) return;

                    let group = prompt('Group (optional)', r.group || '');
                    if (group === null) return;

                    edit.disabled = true;

                    run(META, ['alias', r.mac, name.trim(), group.trim()]).then(function(x) {
                        if (x.code)
                            throw new Error(x.stderr || 'Unable to save');

                        r.name = name.trim() || r.name;
                        r.group = group.trim();
                        draw();
                    }).catch(function(e) {
                        ui.addNotification(null, E('p', {}, t(e.message)), 'error');
                    }).finally(function() {
                        edit.disabled = false;
                    });
                };

                return E('tr', {}, [
                    E('td', {}, [
                        E('div', { 'class': 'm-client-name' }, t(r.name)),
                        E('div', { 'class': r.online ? 'm-online-small' : 'm-offline-small' }, t(r.online ? 'Online' : 'Offline')),
                        r.group ? E('small', {}, t(r.group)) : ''
                    ]),
                    E('td', {}, [
                        E('div', { 'class': 'm-client-ip' }, t(r.ip)),
                        E('div', { 'class': 'm-client-mac' }, t(r.mac))
                    ]),
                    E('td', {}, t(r.type)),
                    E('td', {}, [
                        E('div', {}, t('↓ ' + fmt(r.rx))),
                        E('div', {}, t('↑ ' + fmt(r.tx)))
                    ]),
                    E('td', {}, reserve),
                    E('td', {}, block),
                    E('td', {}, edit)
                ]);
            });

            let table = E('div', { 'class': 'm-table-scroll' }, [
                E('table', { 'class': 'm-client-table' }, [
                    E('thead', {}, [
                        E('tr', {}, ['Device', 'Address', 'Connection', 'Traffic', 'Reserved', 'Block', 'Manage']
                            .map(function(x) { return E('th', {}, t(x)); }))
                    ]),
                    E('tbody', {}, tableRows)
                ])
            ]);

            body.replaceChildren(table);
        }

        search.oninput = draw;
        filter.onchange = draw;
        draw();

        return E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [
                    E('h2', {}, t('Clients')),
                    E('div', { 'class': 'm-subtitle' }, t('Real LAN clients, persistent names, groups and traffic totals'))
                ]),
                E('div', { 'class': 'm-count m-count-green' }, t(state.rows.filter(function(r) { return r.online; }).length + ' online'))
            ]),
            E('div', { 'class': 'm-section' }, [
                E('div', { 'class': 'm-section-header' }, [
                    E('div', {}, [
                        E('h3', {}, t('Device Controls')),
                        E('p', { 'class': 'm-muted' }, t('Quarantine applies only to newly discovered LAN devices.'))
                    ]),
                    E('label', { 'class': 'm-inline-toggle-label' }, [
                        E('span', {}, t('Quarantine new')),
                        quarantine
                    ])
                ]),
                E('div', { 'class': 'm-service-form' }, [search, filter])
            ]),
            E('div', { 'class': 'm-section' }, [body])
        ]);
    }
});
