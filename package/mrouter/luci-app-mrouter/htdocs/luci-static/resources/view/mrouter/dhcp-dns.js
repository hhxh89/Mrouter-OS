'use strict';
'require view';
'require fs';
'require ui';

const H = '/usr/libexec/mrouter-dhcp';

function t(v) {
    return [String(v == null || v === '' ? '—' : v)];
}

function run(a) {
    return fs.exec(H, a || []).catch(e => ({
        code: 1,
        stdout: '',
        stderr: String(e)
    }));
}

function parse(r) {
    let o = { leases: 0, doh: false, s: [], r: [] };

    String((r && r.stdout) || '')
        .split(/\r?\n/)
        .forEach(l => {
            let p = l.split('|');

            if (p[0] === 'STATUS') {
                o.leases = +p[1] || 0;
                o.doh = p[2] === '1';
            }
            else if (p[0] === 'SCOPE') {
                o.s.push({
                    id: p[1],
                    iface: p[2],
                    ignore: p[3] === '1',
                    start: p[4],
                    limit: p[5],
                    lease: p[6]
                });
            }
            else if (p[0] === 'RES') {
                o.r.push({
                    id: p[1],
                    name: p[2],
                    mac: p[3],
                    ip: p[4]
                });
            }
        });

    return o;
}

function ok(r) {
    if (!r || r.code !== 0) {
        ui.addNotification(
            null,
            E('p', {}, t((r && (r.stderr || r.stdout)) || 'Action failed')),
            'error'
        );
        return false;
    }

    return true;
}

function tog(on) {
    let b = E('button', {
        'class': 'm-toggle m-toggle-small' + (on ? ' on' : ''),
        'type': 'button'
    }, [E('span', {})]);

    b.onclick = () => b.classList.toggle('on');
    return b;
}

function scopeTitle(q) {
    let n = String(q.iface || q.id || 'DHCP').toUpperCase();
    return n === 'LAN' ? 'LAN' : n === 'WAN' ? 'WAN' : n;
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    load: () => run(['status']).then(parse),

    render(s) {
        let scopes = E('div', { 'class': 'm-simple-list m-dhcp-scope-list' });

        s.s.forEach(q => {
            let st = E('input', {
                'class': 'm-ios-input',
                'value': q.start
            });

            let lim = E('input', {
                'class': 'm-ios-input',
                'value': q.limit
            });

            let lease = E('input', {
                'class': 'm-ios-input',
                'value': q.lease
            });

            let en = tog(!q.ignore);

            let save = E('button', {
                'class': 'm-secondary-button',
                'type': 'button'
            }, t('Save'));

            save.onclick = () => {
                save.disabled = true;
                run([
                    'scope-save',
                    q.id,
                    st.value,
                    lim.value,
                    lease.value,
                    en.classList.contains('on') ? '1' : '0'
                ]).then(r => {
                    if (ok(r))
                        location.reload();
                    else
                        save.disabled = false;
                });
            };

            scopes.appendChild(
                E('div', { 'class': 'm-app-card m-dhcp-scope-card' }, [
                    E('div', { 'class': 'm-card-title-row m-dhcp-scope-head' }, [
                        E('div', { 'class': 'm-dhcp-scope-title' }, [
                            E('strong', {}, t(scopeTitle(q))),
                            E('span', {}, t('DHCP scope · ' + (q.id || q.iface || '—')))
                        ]),
                        en
                    ]),

                    E('div', { 'class': 'm-dhcp-scope-grid' }, [
                        E('label', {}, [
                            E('span', {}, t('Start offset')),
                            st
                        ]),
                        E('label', {}, [
                            E('span', {}, t('Addresses')),
                            lim
                        ]),
                        E('label', {}, [
                            E('span', {}, t('Lease time')),
                            lease
                        ])
                    ]),

                    E('div', { 'class': 'm-dhcp-scope-actions' }, [save])
                ])
            );
        });

        let name = E('input', {
            'class': 'm-ios-input',
            'placeholder': 'NAS'
        });

        let mac = E('input', {
            'class': 'm-ios-input',
            'placeholder': 'AA:BB:CC:DD:EE:FF'
        });

        let ip = E('input', {
            'class': 'm-ios-input',
            'placeholder': '192.168.11.20'
        });

        let add = E('button', {
            'class': 'm-primary-button',
            'type': 'button'
        }, t('Add Reservation'));

        add.onclick = () => {
            add.disabled = true;
            run([
                'add-reservation',
                mac.value.trim(),
                ip.value.trim(),
                name.value.trim()
            ]).then(r => {
                if (ok(r))
                    location.reload();
                else
                    add.disabled = false;
            });
        };

        let res = E('div', { 'class': 'm-simple-list' });

        s.r.forEach(q => {
            let del = E('button', {
                'class': 'm-danger-outline-button',
                'type': 'button'
            }, t('Delete'));

            del.onclick = () => {
                del.disabled = true;
                run(['delete-reservation', q.id]).then(r => {
                    if (ok(r))
                        location.reload();
                    else
                        del.disabled = false;
                });
            };

            res.appendChild(
                E('div', { 'class': 'm-simple-row' }, [
                    E('div', {}, [
                        E('strong', {}, t(q.name || q.ip)),
                        E('span', {}, t(q.ip + ' · ' + q.mac))
                    ]),
                    del
                ])
            );
        });

        if (!s.r.length)
            res.appendChild(E('div', { 'class': 'm-empty' }, t('No static DHCP reservations.')));

        return E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [
                    E('h2', {}, t('DHCP & DNS')),
                    E('div', { 'class': 'm-subtitle' }, t('DHCP scopes, reservations and encrypted-DNS visibility'))
                ])
            ]),

            E('div', { 'class': 'm-stats-grid' }, [
                E('div', { 'class': 'm-stat-card' }, [
                    E('span', {}, t('Active leases')),
                    E('strong', {}, t(s.leases))
                ]),
                E('div', { 'class': 'm-stat-card' }, [
                    E('span', {}, t('Encrypted DNS service')),
                    E('strong', {}, t(s.doh ? 'Running' : 'Not running'))
                ])
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, t('DHCP Scopes')),
                scopes
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, t('Add Reservation')),
                E('div', { 'class': 'm-policy-form-grid' }, [name, mac, ip]),
                add
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, t('Reservations')),
                res
            ]),

            E('div', { 'class': 'm-info-banner' }, t('Encrypted DNS is optional. Mrouter no longer installs or enables https-dns-proxy merely by installing the package.'))
        ]);
    }
});
