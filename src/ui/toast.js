// Короткие уведомления внизу экрана

export function toast(message, { error = false, ms = 2400 } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = document.createElement('div');
  node.className = 'toast' + (error ? ' toast--error' : '');
  node.textContent = message;
  host.append(node);
  setTimeout(() => node.remove(), ms);
}
