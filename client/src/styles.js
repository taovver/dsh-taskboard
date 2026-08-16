// 看板样式：注入 <style data-plugin>，用 dsh 设计变量 --dsw-alias-*。
export const CSS = `
[data-plugin="task-board-css"] {
  /* 容器占满会话主区 */
}
.tb-board { display: flex; flex-direction: column; gap: 12px; height: 100%; padding: 12px; box-sizing: border-box; }
.tb-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tb-toolbar .tb-title { font-weight: 600; font-size: 15px; }
.tb-columns { display: flex; gap: 10px; flex: 1; overflow-x: auto; align-items: flex-start; }
.tb-column {
  flex: 1 1 0; min-width: 210px; max-width: 280px;
  background: color-mix(in srgb, var(--dsw-alias-bg, #1b1f27) 60%, transparent);
  border: 1px solid var(--dsw-alias-border, #2a2f3a);
  border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 6px;
}
.tb-column-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 2px 4px; }
.tb-column-count {
  font-size: 11px; color: var(--dsw-alias-fg-muted, #8b93a3);
  background: var(--dsw-alias-border, #2a2f3a); border-radius: 999px; padding: 0 8px;
}
.tb-column-list { display: flex; flex-direction: column; gap: 6px; min-height: 40px; }
.tb-card {
  background: var(--dsw-alias-bg-elevated, #22262f);
  border: 1px solid var(--dsw-alias-border, #2a2f3a);
  border-radius: 8px; padding: 8px 10px; cursor: grab; display: flex; flex-direction: column; gap: 4px;
}
.tb-card:hover { border-color: var(--dsw-alias-accent, #5b8cff); }
.tb-card.dragging { opacity: 0.4; }
.tb-card-id { font-size: 10px; color: var(--dsw-alias-fg-muted, #8b93a3); font-family: var(--dsw-font-mono, monospace); }
.tb-card-title { font-size: 13px; line-height: 1.35; word-break: break-word; }
.tb-card-meta { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.tb-pill { font-size: 10px; padding: 0 6px; border-radius: 999px; line-height: 16px; }
.tb-pill-urgent { background: #e5484d33; color: #ff6369; }
.tb-pill-high   { background: #f76b1533; color: #ff9e5e; }
.tb-pill-medium { background: #ffb22433; color: #ffc94d; }
.tb-pill-low    { background: #30a46c33; color: #6bd9a3; }
.tb-label-chip { background: var(--dsw-alias-border, #2a2f3a); color: var(--dsw-alias-fg-muted, #8b93a3); }
.tb-session-chip {
  background: #5b8cff22; color: var(--dsw-alias-accent, #5b8cff);
  cursor: pointer; text-decoration: underline dotted;
}
.tb-column-dragover { outline: 2px dashed var(--dsw-alias-accent, #5b8cff); }
.tb-quickadd input { background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 4px 8px; font-size: 12px; width: 100%; }
.tb-quickadd input:focus { border-color: var(--dsw-alias-accent, #5b8cff); outline: none; }
.tb-new-btn { font-size: 13px; }
.tb-modal-body { display: flex; flex-direction: column; gap: 10px; min-width: 380px; max-width: 560px; }
.tb-field { display: flex; flex-direction: column; gap: 4px; }
.tb-field label { font-size: 11px; color: var(--dsw-alias-fg-muted, #8b93a3); }
.tb-comment { font-size: 12px; border-top: 1px solid var(--dsw-alias-border, #2a2f3a); padding: 6px 0; }
.tb-comment .tb-comment-author { font-weight: 600; margin-right: 6px; }
.tb-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
.tb-empty { font-size: 12px; color: var(--dsw-alias-fg-muted, #8b93a3); text-align: center; padding: 16px 0; }
`;
