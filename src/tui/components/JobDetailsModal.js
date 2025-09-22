import blessed from 'blessed';
import moment from 'moment';

export class JobDetailsModal {
    constructor(screen) {
        this.screen = screen;
        this.modal = null;
    }

    show(job) {
        if (this.modal) {
            this.hide();
        }

        const analysis = job.analysis || 'No analysis available yet.';
        const rawData = job.raw_data ? JSON.parse(job.raw_data) : {};
        
        const content = `
{center}{bold}Job Details{/bold}{/center}

{bold}Title:{/bold} ${job.title}
{bold}Budget:{/bold} ${job.budget.toLocaleString()} THB
{bold}Status:{/bold} ${this.getStatusText(job.status)}
{bold}Created:{/bold} ${moment(job.created_at).format('YYYY-MM-DD HH:mm:ss')}
{bold}Processed:{/bold} ${moment(job.processed_at).format('YYYY-MM-DD HH:mm:ss')}

{bold}Description:{/bold}
${job.description || 'No description available.'}

{bold}AI Analysis:{/bold}
${analysis}

{bold}Fastwork URL:{/bold}
${job.url}

{bold}Tag ID:{/bold} ${job.tag_id || 'N/A'}

${rawData.skills ? `{bold}Required Skills:{/bold} ${rawData.skills.join(', ')}` : ''}
${rawData.deadline ? `{bold}Deadline:{/bold} ${rawData.deadline}` : ''}

{center}Press ESC or Enter to close{/center}
        `.trim();

        this.modal = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: '80%',
            height: '80%',
            label: ' Job Details ',
            content: content,
            tags: true,
            border: {
                type: 'line'
            },
            style: {
                border: {
                    fg: 'white'
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

    getStatusText(status) {
        const statusMap = {
            'pending': '⏳ Pending Analysis',
            'analyzed': '🧠 Analyzed',
            'notified': '📢 Notified',
            'error': '❌ Error'
        };
        return statusMap[status] || '❓ Unknown';
    }

    hide() {
        if (this.modal) {
            this.modal.destroy();
            this.modal = null;
            this.screen.render();
        }
    }
}