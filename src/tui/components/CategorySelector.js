import blessed from 'blessed';
import { CategoryManager } from '../../config/categories.js';

export class CategorySelector {
    constructor(screen) {
        this.screen = screen;
        this.modal = null;
        this.categoryManager = new CategoryManager();
        this.onCategoriesChanged = null;
    }

    show(callback) {
        if (this.modal) {
            this.hide();
        }

        this.onCategoriesChanged = callback;
        
        const categories = this.categoryManager.getFormattedCategoriesList();
        
        this.modal = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: '60%',
            height: '60%',
            label: ' Select Job Categories ',
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

        // Create checkboxes for each category
        this.checkboxes = [];
        let yOffset = 1;

        const instructionText = blessed.text({
            parent: this.modal,
            top: 0,
            left: 2,
            content: 'Use Space to toggle, Enter to apply, Esc to cancel:',
            style: {
                fg: 'yellow'
            }
        });

        categories.forEach((category, index) => {
            const checkbox = blessed.checkbox({
                parent: this.modal,
                top: yOffset + index + 1,
                left: 2,
                width: '90%',
                height: 1,
                content: `${category.name} (${category.nameTh})`,
                checked: category.enabled,
                mouse: true,
                keys: true,
                style: {
                    fg: 'white',
                    focus: {
                        fg: 'black',
                        bg: 'cyan'
                    }
                }
            });

            checkbox.categoryId = category.id;
            this.checkboxes.push(checkbox);
        });

        // Create buttons
        const buttonY = yOffset + categories.length + 2;
        
        const applyButton = blessed.button({
            parent: this.modal,
            top: buttonY,
            left: 2,
            width: 10,
            height: 3,
            content: 'Apply',
            align: 'center',
            border: {
                type: 'line'
            },
            style: {
                border: {
                    fg: 'green'
                },
                focus: {
                    bg: 'green',
                    fg: 'black'
                }
            },
            mouse: true
        });

        const cancelButton = blessed.button({
            parent: this.modal,
            top: buttonY,
            left: 15,
            width: 10,
            height: 3,
            content: 'Cancel',
            align: 'center',
            border: {
                type: 'line'
            },
            style: {
                border: {
                    fg: 'red'
                },
                focus: {
                    bg: 'red',
                    fg: 'black'
                }
            },
            mouse: true
        });

        // Event handlers
        applyButton.on('press', () => {
            this.applyChanges();
        });

        cancelButton.on('press', () => {
            this.hide();
        });

        this.modal.key(['escape'], () => {
            this.hide();
        });

        this.modal.key(['enter'], () => {
            this.applyChanges();
        });

        // Focus management
        this.checkboxes[0].focus();
        
        this.modal.key(['tab'], () => {
            const focused = this.screen.focused;
            const focusableElements = [...this.checkboxes, applyButton, cancelButton];
            const currentIndex = focusableElements.indexOf(focused);
            const nextIndex = (currentIndex + 1) % focusableElements.length;
            focusableElements[nextIndex].focus();
        });

        this.modal.key(['S-tab'], () => {
            const focused = this.screen.focused;
            const focusableElements = [...this.checkboxes, applyButton, cancelButton];
            const currentIndex = focusableElements.indexOf(focused);
            const prevIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
            focusableElements[prevIndex].focus();
        });

        this.screen.render();
    }

    applyChanges() {
        const enabledCategories = [];
        
        this.checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                enabledCategories.push(checkbox.categoryId);
            }
        });

        // Update category manager
        this.categoryManager.config.categories.enabled = enabledCategories;

        if (this.onCategoriesChanged) {
            this.onCategoriesChanged(enabledCategories);
        }

        this.hide();
    }

    hide() {
        if (this.modal) {
            this.modal.destroy();
            this.modal = null;
            this.checkboxes = [];
            this.screen.render();
        }
    }

    getEnabledCategories() {
        return this.categoryManager.getEnabledCategories();
    }
}