'use strict';
'require view';


return view.extend({

    handleSaveApply: null,
    handleSave: null,
    handleReset: null,


    render: function() {

        var host =
            window.location.hostname;

        var terminalUrl =
            'https://' +
            host +
            ':7681/';


        return E('div', {
            'class': 'mrouter-page'
        }, [

            E('div', {
                'class': 'm-page-title'
            }, [

                E('div', {}, [

                    E('h2', {}, [
                        'Terminal'
                    ]),

                    E('div', {
                        'class': 'm-subtitle'
                    }, [
                        'Secure terminal access to Mrouter-OS'
                    ])
                ]),


                E('span', {
                    'class':
                        'm-status-pill m-status-online'
                }, [
                    'Running'
                ])
            ]),


            E('div', {
                'class': 'm-terminal-toolbar'
            }, [

                E('div', {}, [

                    E('strong', {}, [
                        'Mrouter-OS Terminal'
                    ]),

                    E('span', {}, [
                        'HTTPS • Port 7681'
                    ])
                ]),


                E('a', {
                    'class':
                        'm-secondary-link-button',

                    'href':
                        terminalUrl,

                    'target':
                        '_blank',

                    'rel':
                        'noopener'
                }, [
                    'Open Directly'
                ])
            ]),


            E('div', {
                'class':
                    'm-terminal-notice'
            }, [

                E('strong', {}, [
                    'First connection only'
                ]),

                E('span', {}, [
                    'If the terminal area is blank, press Open Directly, accept the local certificate warning, then return here and refresh.'
                ])
            ]),


            E('iframe', {

                'src':
                    terminalUrl,

                'class':
                    'mrouter-terminal-frame',

                'allow':
                    'clipboard-read; clipboard-write',

                'referrerpolicy':
                    'same-origin'

            })
        ]);
    }
});
