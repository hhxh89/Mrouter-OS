'use strict';
'require view';
'require fs';
'require rpc';
'require ui';

const HELPER = '/usr/libexec/mrouter-policy';
const CLIENT_HELPER = '/usr/libexec/mrouter-client-data';

const getLeases = rpc.declare({
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

function tx(v) {
    return [ String(v == null || v === '' ? '—' : v) ];
}

function makeToggle(on) {
    return E('button', {
        'class': 'm-toggle m-toggle-small' + (on ? ' on' : ''),
        'type': 'button'
    }, [ E('span', {}) ]);
}

function parseState(r) {
    let out = {
        enabled: false,
        running: false,
        strict: false,
        resolver: 'none',
        dnsNft: false,
        adguard: false,
        targets: [],
        groups: [],
        policies: []
    };

    String((r && r.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');

        if (p[0] === 'STATUS') {
            out.enabled = p[1] === '1';
            out.running = p[2] === '1';
            out.strict = p[3] === '1';
            out.resolver = p[4] || 'none';
            out.dnsNft = p[5] === '1';
            out.adguard = p[6] === '1';
        }

        if (p[0] === 'TARGET') {
            out.targets.push({
                id: p[1],
                label: p[2],
                up: p[3] === '1'
            });
        }

        if (p[0] === 'GROUP') {
            out.groups.push({
                id: p[1],
                name: p[2],
                macs: p[3] || ''
            });
        }

        if (p[0] === 'POLICY') {
            out.policies.push({
                id: p[1],
                name: p[2],
                interface: p[3],
                source: p[4],
                destination: p[5],
                enabled: p[6] === '1',
                sourceType: p[7],
                sourceValue: p[8],
                destType: p[9],
                destValue: p[10],
                target: p[11],
                fail: p[12],
                fallback: p[13],
                schedule: p[14],
                days: p[15],
                hours: p[16]
            });
        }
    });

    return out;
}

function parseClients(dhcp, raw) {
    let clients = {};

    (dhcp.dhcp_leases || []).forEach(function(l) {
        let mac = String(l.macaddr || '').toUpperCase();
        if (!mac) return;

        clients[mac] = {
            mac: mac,
            ip: l.ipaddr || '',
            name: l.hostname && l.hostname !== '*' ? l.hostname : (l.ipaddr || 'Unknown device')
        };
    });

    let names = {};
    String((raw && raw.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');
        if (p[0] === 'H' && p.length >= 3) { names[String(p[1]||'').toUpperCase()] = p.slice(2).join('|'); return; }
        if (p[0] !== 'N' || p.length < 3) return;
        let mac = String(p[2]).toUpperCase();
        if (!clients[mac]) clients[mac] = { mac:mac, ip:p[1]||'', name:'Unknown device' };
    });
    Object.keys(names).forEach(function(mac){ if (clients[mac] && (!clients[mac].name || clients[mac].name === 'Unknown device' || clients[mac].name === clients[mac].ip)) clients[mac].name=names[mac]; });

    return Object.keys(clients).sort().map(function(k) { return clients[k]; });
}

function targetSelect(targets) {
    let select = E('select', { 'class': 'm-ios-input' });

    targets.forEach(function(t) {
        select.appendChild(E('option', {
            'value': t.id
        }, tx(t.label + (t.up ? '' : ' — offline'))));
    });

    return select;
}

function failText(v) {
    if (v === 'wan') return 'Fall back to WAN';
    if (v === 'other') return 'Try another VPN';
    return 'Block traffic';
}

function sourceText(p) {
    switch (p.sourceType) {
    case 'all': return 'Everyone';
    case 'devices': return p.sourceValue || p.source;
    case 'group': return 'Device group';
    case 'iot': return 'IoT Network';
    case 'wgremote': return 'WireGuard remote users';
    case 'tailscale': return 'Tailscale remote users';
    case 'subnet': return p.sourceValue || p.source;
    default: return p.source || 'Any source';
    }
}

function destinationText(p) {
    switch (p.destType) {
    case 'all': return 'All destinations';
    case 'service': return 'Service: ' + p.destValue;
    case 'country': return 'Country: ' + String(p.destValue || '').toUpperCase();
    case 'subscription': return 'Subscription list';
    case 'exclude': return 'Everything except: ' + p.destValue;
    case 'custom': return p.destValue || p.destination;
    default: return p.destination || 'All destinations';
    }
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    load: function() {
        return Promise.all([
            mrouterExec('/usr/libexec/mrouter-status-policy', [], { stdout: '' }, 4500),
            mrouterBounded(getLeases(), { dhcp_leases: [] }, 4500),
            mrouterExec(CLIENT_HELPER, [ 'snapshot' ], { stdout: '' }, 4500)
        ]);
    },

    render: function(data) {
        let state = parseState(data[0]);
        let clients = parseClients(data[1] || {}, data[2]);
        let selectedMacs = new Set();
        let groupMacs = new Set();

        let serviceToggle = makeToggle(state.enabled);
        serviceToggle.addEventListener('click', function() {
            let wanted = !serviceToggle.classList.contains('on');
            serviceToggle.disabled = true;

            fs.exec(HELPER, [ 'service', wanted ? '1' : '0' ])
                .then(function() { window.location.reload(); });
        });

        let name = E('input', {
            'class': 'm-ios-input m-wide-input',
            'type': 'text',
            'placeholder': 'e.g. Streaming TVs'
        });

        let sourceType = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': 'devices' }, tx('Selected devices')),
            E('option', { 'value': 'group' }, tx('Device group')),
            E('option', { 'value': 'iot' }, tx('IoT Network')),
            E('option', { 'value': 'wgremote' }, tx('WireGuard remote users')),
            E('option', { 'value': 'tailscale' }, tx('Tailscale remote users')),
            E('option', { 'value': 'subnet' }, tx('IP / subnet')),
            E('option', { 'value': 'all' }, tx('Everyone'))
        ]);

        let groupSelect = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': '' }, tx('Select group'))
        ]);

        state.groups.forEach(function(g) {
            groupSelect.appendChild(E('option', { 'value': g.id }, tx(g.name)));
        });

        let subnetInput = E('input', {
            'class': 'm-ios-input m-wide-input',
            'type': 'text',
            'placeholder': '192.168.50.0/24'
        });

        let clientSelector = E('div', { 'class': 'm-client-selector' });

        clients.forEach(function(c) {
            let chip = E('button', {
                'class': 'm-client-chip',
                'type': 'button'
            }, [
                E('strong', {}, tx(c.name)),
                E('span', {}, tx(c.ip + ' • ' + c.mac))
            ]);

            chip.addEventListener('click', function() {
                if (selectedMacs.has(c.mac)) {
                    selectedMacs.delete(c.mac);
                    chip.classList.remove('selected');
                }
                else {
                    selectedMacs.add(c.mac);
                    chip.classList.add('selected');
                }
            });

            clientSelector.appendChild(chip);
        });

        if (!clients.length)
            clientSelector.appendChild(E('div', { 'class': 'm-empty' },
                tx('No clients currently detected.')));

        let destType = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': 'all' }, tx('Everywhere')),
            E('option', { 'value': 'custom' }, tx('Websites / IPs')),
            E('option', { 'value': 'service' }, tx('Service preset')),
            E('option', { 'value': 'country' }, tx('Country / region')),
            E('option', { 'value': 'subscription' }, tx('Subscription URL')),
            E('option', { 'value': 'exclude' }, tx('Everything except…'))
        ]);

        let destInput = E('textarea', {
            'class': 'm-policy-destination',
            'placeholder': 'netflix.com\nbbc.co.uk\n1.1.1.1\n203.0.113.0/24'
        });

        let servicePreset = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': 'netflix' }, tx('Netflix')),
            E('option', { 'value': 'bbc' }, tx('BBC iPlayer')),
            E('option', { 'value': 'itv' }, tx('ITVX')),
            E('option', { 'value': 'disney' }, tx('Disney+')),
            E('option', { 'value': 'prime' }, tx('Prime Video')),
            E('option', { 'value': 'youtube' }, tx('YouTube')),
            E('option', { 'value': 'teams' }, tx('Microsoft Teams')),
            E('option', { 'value': 'zoom' }, tx('Zoom')),
            E('option', { 'value': 'discord' }, tx('Discord'))
        ]);

        let country = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': 'gb' }, tx('United Kingdom')),
            E('option', { 'value': 'us' }, tx('United States')),
            E('option', { 'value': 'de' }, tx('Germany')),
            E('option', { 'value': 'fr' }, tx('France')),
            E('option', { 'value': 'nl' }, tx('Netherlands')),
            E('option', { 'value': 'ch' }, tx('Switzerland')),
            E('option', { 'value': 'ro' }, tx('Romania')),
            E('option', { 'value': 'es' }, tx('Spain')),
            E('option', { 'value': 'it' }, tx('Italy'))
        ]);

        let subscription = E('input', {
            'class': 'm-ios-input m-wide-input',
            'type': 'url',
            'placeholder': 'https://example.com/list.txt'
        });

        let via = targetSelect(state.targets);
        let fail = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': 'block' }, tx('Block traffic')),
            E('option', { 'value': 'wan' }, tx('Fall back to WAN')),
            E('option', { 'value': 'other' }, tx('Try another VPN'))
        ]);
        let fallback = targetSelect(state.targets);

        let schedule = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': 'always' }, tx('Always')),
            E('option', { 'value': 'weekdays' }, tx('Weekdays')),
            E('option', { 'value': 'weekends' }, tx('Weekends')),
            E('option', { 'value': 'custom' }, tx('Custom days'))
        ]);

        let days = E('input', {
            'class': 'm-ios-input',
            'type': 'text',
            'value': '1,2,3,4,5',
            'placeholder': '1,2,3,4,5'
        });

        let start = E('input', {
            'class': 'm-ios-input',
            'type': 'time',
            'value': '00:00'
        });

        let end = E('input', {
            'class': 'm-ios-input',
            'type': 'time',
            'value': '23:59'
        });

        function updateSourceVisibility() {
            clientSelector.style.display =
                sourceType.value === 'devices' ? '' : 'none';

            groupSelect.style.display =
                sourceType.value === 'group' ? '' : 'none';

            subnetInput.style.display =
                sourceType.value === 'subnet' ? '' : 'none';
        }

        function updateDestVisibility() {
            let v = destType.value;

            destInput.style.display =
                (v === 'custom' || v === 'exclude') ? '' : 'none';

            servicePreset.style.display =
                v === 'service' ? '' : 'none';

            country.style.display =
                v === 'country' ? '' : 'none';

            subscription.style.display =
                v === 'subscription' ? '' : 'none';
        }

        function updateFailVisibility() {
            fallback.style.display =
                fail.value === 'other' ? '' : 'none';
        }

        function updateScheduleVisibility() {
            let timed = schedule.value !== 'always';
            let custom = schedule.value === 'custom';

            days.style.display = custom ? '' : 'none';
            start.style.display = timed ? '' : 'none';
            end.style.display = timed ? '' : 'none';
        }

        sourceType.addEventListener('change', updateSourceVisibility);
        destType.addEventListener('change', updateDestVisibility);
        fail.addEventListener('change', updateFailVisibility);
        schedule.addEventListener('change', updateScheduleVisibility);

        updateSourceVisibility();
        updateDestVisibility();
        updateFailVisibility();
        updateScheduleVisibility();

        let add = E('button', { 'class': 'm-primary-button' }, tx('Add Policy'));

        add.addEventListener('click', function() {
            let sv = '';

            if (sourceType.value === 'devices')
                sv = Array.from(selectedMacs).join(',');
            else if (sourceType.value === 'group')
                sv = groupSelect.value;
            else if (sourceType.value === 'subnet')
                sv = subnetInput.value.trim();

            let dv = '';

            if (destType.value === 'custom' || destType.value === 'exclude')
                dv = destInput.value.trim();
            else if (destType.value === 'service')
                dv = servicePreset.value;
            else if (destType.value === 'country')
                dv = country.value;
            else if (destType.value === 'subscription')
                dv = subscription.value.trim();

            add.disabled = true;

            fs.exec(HELPER, [
                'add',
                name.value.trim(),
                sourceType.value,
                sv,
                destType.value,
                dv,
                via.value,
                fail.value,
                fallback.value,
                schedule.value,
                days.value.trim(),
                start.value || '00:00',
                end.value || '23:59'
            ]).then(function(r) {
                if (!r || r.code !== 0)
                    throw new Error((r && (r.stderr || r.stdout)) || 'Unable to create policy');

                window.location.reload();
            }).catch(function(err) {
                ui.addNotification(null, E('p', {}, tx(err.message)));
                add.disabled = false;
            });
        });

        // Device Groups
        let groupName = E('input', {
            'class': 'm-ios-input',
            'type': 'text',
            'placeholder': 'e.g. Streaming'
        });

        let groupSelector = E('div', { 'class': 'm-client-selector' });

        clients.forEach(function(c) {
            let chip = E('button', { 'class': 'm-client-chip', 'type': 'button' }, [
                E('strong', {}, tx(c.name)),
                E('span', {}, tx(c.mac))
            ]);

            chip.addEventListener('click', function() {
                if (groupMacs.has(c.mac)) {
                    groupMacs.delete(c.mac);
                    chip.classList.remove('selected');
                }
                else {
                    groupMacs.add(c.mac);
                    chip.classList.add('selected');
                }
            });

            groupSelector.appendChild(chip);
        });

        let addGroup = E('button', { 'class': 'm-secondary-button' }, tx('Create Group'));

        addGroup.addEventListener('click', function() {
            addGroup.disabled = true;

            fs.exec(HELPER, [
                'group-add',
                groupName.value.trim(),
                Array.from(groupMacs).join(',')
            ]).then(function(r) {
                if (!r || r.code !== 0)
                    throw new Error((r && (r.stderr || r.stdout)) || 'Unable to create group');

                window.location.reload();
            }).catch(function(err) {
                ui.addNotification(null, E('p', {}, tx(err.message)));
                addGroup.disabled = false;
            });
        });

        let groupList = E('div', { 'class': 'm-group-list' });

        state.groups.forEach(function(g) {
            let del = E('button', { 'class': 'm-policy-delete' }, tx('Delete'));

            del.addEventListener('click', function() {
                if (!confirm('Delete device group "' + g.name + '"?'))
                    return;

                del.disabled = true;
                fs.exec(HELPER, [ 'group-delete', g.id ])
                    .then(function() { window.location.reload(); });
            });

            groupList.appendChild(E('div', { 'class': 'm-group-row' }, [
                E('div', {}, [
                    E('strong', {}, tx(g.name)),
                    E('span', {}, tx(g.macs || 'No devices'))
                ]),
                del
            ]));
        });

        // Existing policies
        let policyList = E('div', { 'class': 'm-policy-list' });

        if (!state.policies.length)
            policyList.appendChild(E('div', { 'class': 'm-empty' },
                tx('No routing policies configured.')));

        state.policies.forEach(function(p, index) {
            let toggle = makeToggle(p.enabled);
            let up = E('button', { 'class': 'm-order-button', 'title': 'Move up' }, tx('↑'));
            let down = E('button', { 'class': 'm-order-button', 'title': 'Move down' }, tx('↓'));
            let del = E('button', { 'class': 'm-policy-delete' }, tx('Delete'));

            toggle.addEventListener('click', function() {
                let wanted = !toggle.classList.contains('on');
                toggle.disabled = true;
                fs.exec(HELPER, [ 'toggle', p.id, wanted ? '1' : '0' ])
                    .then(function() { window.location.reload(); });
            });

            up.disabled = index === 0;
            down.disabled = index === state.policies.length - 1;

            up.addEventListener('click', function() {
                up.disabled = true;
                fs.exec(HELPER, [ 'move', p.id, 'up' ])
                    .then(function() { window.location.reload(); });
            });

            down.addEventListener('click', function() {
                down.disabled = true;
                fs.exec(HELPER, [ 'move', p.id, 'down' ])
                    .then(function() { window.location.reload(); });
            });

            del.addEventListener('click', function() {
                if (!confirm('Delete policy "' + p.name + '"?'))
                    return;

                del.disabled = true;
                fs.exec(HELPER, [ 'delete', p.id ])
                    .then(function() { window.location.reload(); });
            });

            policyList.appendChild(E('div', { 'class': 'm-policy-card m-policy-card-current' }, [
                E('div', { 'class': 'm-policy-order' }, [
                    E('span', {}, tx(index + 1)),
                    up,
                    down
                ]),
                E('div', { 'class': 'm-policy-main-text' }, [
                    E('strong', {}, tx(p.name)),
                    E('span', {}, tx(sourceText(p) + ' → ' + destinationText(p))),
                    E('small', {}, tx(
                        'Via ' + (p.target || p.interface) +
                        ' • ' + failText(p.fail) +
                        (p.schedule && p.schedule !== 'always' ? ' • ' + p.schedule + ' ' + p.hours : '')
                    ))
                ]),
                E('div', { 'class': 'm-inline-actions' }, [
                    toggle,
                    del
                ])
            ]));
        });

        // Rule tester
        let testClient = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': '||' }, tx('Select a client'))
        ]);

        clients.forEach(function(c) {
            testClient.appendChild(E('option', {
                'value': c.mac + '|' + c.ip
            }, tx(c.name + ' — ' + c.ip)));
        });

        let testDest = E('input', {
            'class': 'm-ios-input',
            'type': 'text',
            'placeholder': 'netflix.com'
        });

        let testResult = E('div', { 'class': 'm-test-result m-empty' },
            tx('Choose a device and destination to preview which policy matches first.'));

        let testBtn = E('button', { 'class': 'm-secondary-button' }, tx('Test Route'));

        testBtn.addEventListener('click', function() {
            let c = testClient.value.split('|');
            if (!c[0] || !testDest.value.trim()) {
                ui.addNotification(null, E('p', {}, tx('Select a client and enter a destination.')));
                return;
            }

            testBtn.disabled = true;

            fs.exec(HELPER, [
                'test',
                c[0],
                c[1],
                testDest.value.trim()
            ]).then(function(r) {
                if (!r || r.code !== 0)
                    throw new Error((r && (r.stderr || r.stdout)) || 'Route test failed');

                let matches = [];

                String(r.stdout || '').split(/\r?\n/).forEach(function(line) {
                    let p = line.split('|');
                    if (p[0] === 'TEST')
                        matches.push({
                            order: p[1],
                            name: p[2],
                            target: p[3],
                            fail: p[4]
                        });
                });

                if (!matches.length || matches[0].order === '0') {
                    L.dom.content(testResult, [
                        E('strong', {}, tx('No VPN policy matched')),
                        E('span', {}, tx('This traffic will use normal WAN routing.'))
                    ]);
                }
                else {
                    L.dom.content(testResult, [
                        E('strong', {}, tx('✓ First match: ' + matches[0].name)),
                        E('span', {}, tx(
                            'Route via ' + matches[0].target +
                            ' • ' + failText(matches[0].fail) +
                            (matches.length > 1 ? ' • ' + matches.length + ' rules matched; the first has priority.' : '')
                        ))
                    ]);
                }

                testResult.classList.remove('m-empty');
            }).catch(function(err) {
                ui.addNotification(null, E('p', {}, tx(err.message)));
            }).finally(function() {
                testBtn.disabled = false;
            });
        });

        // DNS health
        let dnsGood = state.dnsNft;
        let dnsMessage = '';

        if (!state.dnsNft)
            dnsMessage = 'dnsmasq nft-set support was not detected. Domain policies can still resolve at PBR start, but live domain routing is less reliable.';
        else if (state.adguard)
            dnsMessage = 'dnsmasq-full nft-set support is available. When AdGuard Home is enabled, Mrouter-OS keeps dnsmasq as the PBR resolver behind AdGuard.';
        else
            dnsMessage = 'dnsmasq-full nft-set support is active and suitable for domain-based PBR.';

        return E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [
                    E('h2', {}, tx('VPN Policy Routing')),
                    E('div', { 'class': 'm-subtitle' },
                        tx('FROM → TO → VIA → IF VPN FAILS'))
                ]),
                E('div', { 'class': 'm-inline-actions' }, [
                    E('span', {
                        'class': 'm-status-pill ' + (!state.enabled ? '' : (state.running ? 'm-status-online' : 'm-status-offline'))
                    }, tx(!state.enabled ? 'Disabled' : (state.running ? 'Active' : 'Error'))),
                    serviceToggle
                ])
            ]),

            E('div', { 'class': dnsGood ? 'm-policy-health good' : 'm-policy-health warn' }, [
                E('strong', {}, tx('DNS / Domain Policy Health')),
                E('span', {}, tx(dnsMessage)),
                E('small', {}, tx(
                    'Resolver: ' + state.resolver +
                    ' • PBR strict enforcement: ' + (state.strict ? 'ON' : 'OFF')
                ))
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, tx('Create Policy')),

                E('div', { 'class': 'm-policy-step-grid' }, [
                    E('div', { 'class': 'm-policy-step' }, [
                        E('b', {}, tx('1')),
                        E('strong', {}, tx('FROM')),
                        E('span', {}, tx('Who should this rule apply to?')),
                        sourceType,
                        groupSelect,
                        subnetInput,
                        clientSelector
                    ]),

                    E('div', { 'class': 'm-policy-step' }, [
                        E('b', {}, tx('2')),
                        E('strong', {}, tx('TO')),
                        E('span', {}, tx('Which destination should match?')),
                        destType,
                        destInput,
                        servicePreset,
                        country,
                        subscription
                    ]),

                    E('div', { 'class': 'm-policy-step' }, [
                        E('b', {}, tx('3')),
                        E('strong', {}, tx('VIA')),
                        E('span', {}, tx('Choose the route or VPN tunnel.')),
                        via
                    ]),

                    E('div', { 'class': 'm-policy-step' }, [
                        E('b', {}, tx('4')),
                        E('strong', {}, tx('IF VPN FAILS')),
                        E('span', {}, tx('Make the failure behaviour explicit.')),
                        fail,
                        fallback
                    ])
                ]),

                E('div', { 'class': 'm-policy-options-row' }, [
                    E('label', {}, [ E('span', {}, tx('Policy name')), name ]),
                    E('label', {}, [ E('span', {}, tx('Schedule')), schedule ]),
                    E('label', {}, [ E('span', {}, tx('Custom days (1=Mon)')), days ]),
                    E('label', {}, [ E('span', {}, tx('Start')), start ]),
                    E('label', {}, [ E('span', {}, tx('End')), end ])
                ]),

                E('div', { 'class': 'm-policy-help' }, tx(
                    'Country rules use a live IP-country list URL. Subscription rules can point to your own maintained IP/CIDR list. Policy order is priority: the first matching rule wins.'
                )),

                E('div', { 'class': 'm-app-actions' }, [ add ])
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, tx('Device Groups')),
                E('div', { 'class': 'm-group-create' }, [
                    groupName,
                    addGroup
                ]),
                groupSelector,
                groupList
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, tx('Rule Tester')),
                E('div', { 'class': 'm-route-test-form' }, [
                    testClient,
                    testDest,
                    testBtn
                ]),
                testResult
            ]),

            E('div', { 'class': 'm-section' }, [
                E('div', { 'class': 'm-section-header' }, [
                    E('div', {}, [
                        E('h3', {}, tx('Routing Policies')),
                        E('div', { 'class': 'm-muted' },
                            tx('Use ↑ and ↓ to set first-match priority.'))
                    ])
                ]),
                policyList
            ]),

            E('div', { 'class': 'm-all-other-card' }, [
                E('div', {}, [
                    E('span', {}, tx('ALL OTHER TRAFFIC')),
                    E('strong', {}, tx('Direct Internet (WAN)')),
                    E('small', {}, tx(
                        'Unmatched traffic uses WAN. Each VPN policy independently decides whether to block, use WAN, or try another VPN when its preferred tunnel is unavailable.'
                    ))
                ]),
                E('span', { 'class': 'm-vpn-state on' }, tx('ON'))
            ])
        ]);
    }
});
