import blessed from 'blessed';

export class HelpModal {
    constructor(screen) {
        this.screen = screen;
        this.modal = null;
    }

    show() {
        if (this.modal) {
            this.hide();
        }

        const content = `
{center}{bold}Fastwork Job Bot - Help{/bold}{/center}

{bold}Navigation:{/bold}
  Tab              Navigate between panels
  Arrow Keys       Move within panels
  Enter            Select item / Execute action
  Escape / Q       Quit application

{bold}Keyboard Shortcuts:{/bold}
  R                Run bot execution
  A                Analyze pending jobs
  T                Test API connections
  C                Configure job categories
  F5               Refresh data
  H / ?            Show this help

{bold}Menu Options:{/bold}
  Dashboard        System overview and statistics
  Jobs             Browse and view job listings
  Categories       Configure job categories to monitor
  Run Bot          Execute full bot workflow
  Analyze          Analyze pending jobs only
  Test APIs        Check API connectivity
  Config           View configuration status
  Quit             Exit application

{bold}Job Status Icons:{/bold}
  ⏳ Pending       Job fetched, awaiting analysis
  🧠 Analyzed      Job analyzed by Claude AI
  📢 Notified      Notifications sent successfully
  ❌ Error         Processing error occurred

{bold}Auto-refresh:{/bold}
Data automatically refreshes every 30 seconds while idle.

{bold}Database:{/bold}
All job data is stored in SQLite database (jobs.db).

{center}Press ESC or Enter to close{/center}
        `.trim();

        this.modal = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: '70%',
            height: '70%',
            label: ' Help ',
            content: content,
            tags: true,
            border: {
                type: 'line'
            },
            style: {
                border: {
                    fg: 'cyan'
                },
                bg: 'black',
                fg: 'white'
            },
            scrollable: true,
            mouse: true,
            keys: true
        });

        this.modal.key(['escape', 'enter', 'q'], () => {
            this.hide();
        });

        this.modal.focus();
        this.screen.render();
    }

    hide() {
        if (this.modal) {
            this.modal.destroy();
            this.modal = null;
            this.screen.render();
        }
    }
}