import Noty from 'noty';

/**
 * Shows the relation suggestion prompt with the supplied semantic actions.
 * DOM and Noty details stay behind this adapter seam.
 *
 * @param {object} dependencies
 * @param {object} dependencies.suggestion
 * @param {string} dependencies.otherUserName
 * @param {function} dependencies.onAccept
 * @param {function} dependencies.onIgnore
 * @param {function} [dependencies.createNotification]
 * @returns {object}
 */
export function showRelationSuggestionNotification({
    suggestion,
    otherUserName,
    onAccept,
    onIgnore,
    createNotification = (options) => new Noty(options)
}) {
    const notification = createNotification({
        type: 'alert',
        timeout: 6000,
        progressBar: true,
        text: `
                            <div class="noty-rel-popup" data-main-dialog-interactive>
                                <div class="mb-2">【推测关联】你觉得本玩家和 <strong>${otherUserName}</strong> 是好友吗？</div>
                                <div class="flex gap-3 justify-end mt-3">
                                    <button class="noty-btn-yes px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-md transition-all active:scale-95">是好友</button>
                                    <button class="noty-btn-no px-4 py-1.5 bg-transparent border border-zinc-500/50 hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 rounded text-xs transition-all active:scale-95">忽略</button>
                                </div>
                            </div>
                        `,
        callbacks: {
            onShow: function () {
                if (this.barDom) {
                    this.barDom.style.setProperty(
                        'z-index',
                        '2147483647',
                        'important'
                    );
                    this.barDom.style.setProperty(
                        'pointer-events',
                        'auto',
                        'important'
                    );
                    if (this.barDom.parentElement) {
                        this.barDom.parentElement.style.setProperty(
                            'z-index',
                            '2147483647',
                            'important'
                        );
                        this.barDom.parentElement.style.setProperty(
                            'pointer-events',
                            'auto',
                            'important'
                        );
                    }
                }
                const pb = this.barDom.querySelector('.noty_progressbar');
                if (pb) {
                    pb.style.backgroundColor = '#9ca3af';
                    pb.style.opacity = '0.8';
                }

                const yesBtn = this.barDom.querySelector('.noty-btn-yes');
                if (yesBtn) {
                    yesBtn.addEventListener('click', () => {
                        onAccept(suggestion);
                        notification.close();
                    });
                }
                const noBtn = this.barDom.querySelector('.noty-btn-no');
                if (noBtn) {
                    noBtn.addEventListener('click', () => {
                        onIgnore(suggestion);
                        notification.close();
                    });
                }
            }
        }
    });
    notification.show();
    return notification;
}
