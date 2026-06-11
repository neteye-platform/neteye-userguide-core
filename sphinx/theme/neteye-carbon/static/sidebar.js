class sideBarMenu {
    constructor() {
        this.triggers = document.querySelectorAll('.toggle-control');
        this.sidePanel = document.querySelector('.side-navigation-panel');
        this.sideMenuOverlay = document.querySelector('.side-menu-overlay');
        this.init();
    }

    init() {
        this.triggers.forEach(
            (el) => el.addEventListener(
                'click',
                () => {
                    this.handleToggle();
                }
            )
        )

        this.sideMenuOverlay.addEventListener('click', () => {
            this.handleToggle();
        })

        window.addEventListener('load', () => {
            setTimeout(() => {
                this.sidePanel.shadowRoot.querySelector('.cds--side-nav--ux').classList.add('loaded');
            }, 500)
        })

        document.body.addEventListener('mouseup', (event) => {
            if (event.target.matches('cds-header-menu-button')) {
                this.sidePanel.classList.remove('open');
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' || event.key === 'Esc') {
                this.handleToggle(true);
            }
        });

    }

    handleToggle(forceClose = false) {
        if(forceClose) {
            this.sidePanel.classList.remove('open');
            this.sidePanel.shadowRoot.querySelector('.cds--side-nav--ux').classList.remove('show-parent-menu');
            document.documentElement.classList.remove('show-parent-menu');
            return
        }
        this.sidePanel.classList.toggle('open');
        this.sidePanel.querySelector('.side-panel-header .close-parent-menu').classList.add('prevent-hover');
        this.sidePanel.querySelector('.side-panel-header .close-parent-menu').addEventListener('mouseout', () => {
            this.sidePanel.querySelector('.side-panel-header .close-parent-menu').classList.remove('prevent-hover');
        })
        this.sidePanel.shadowRoot.querySelector('.cds--side-nav--ux').classList.toggle('show-parent-menu');
        document.documentElement.classList.toggle('show-parent-menu');
    }
}

window.addEventListener("load", () => {
    new sideBarMenu();
});
