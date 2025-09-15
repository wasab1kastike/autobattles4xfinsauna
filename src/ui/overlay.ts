export function showError(messages: string[]): void {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return;

  const blocker = document.createElement('div');
  blocker.id = 'error-overlay';
  blocker.style.position = 'absolute';
  blocker.style.inset = '0';
  blocker.style.background = 'rgba(0, 0, 0, 0.75)';
  blocker.style.display = 'flex';
  blocker.style.alignItems = 'center';
  blocker.style.justifyContent = 'center';
  blocker.style.pointerEvents = 'auto';
  blocker.style.zIndex = '1000';

  const panel = document.createElement('div');
  panel.className = 'card';
  panel.style.background = 'rgba(20, 20, 20, 0.9)';
  panel.style.color = 'white';
  panel.style.maxWidth = '80%';
  panel.style.textAlign = 'center';
  panel.style.padding = 'var(--gap-lg)';

  const title = document.createElement('h2');
  title.textContent = 'Asset load errors';
  panel.appendChild(title);

  const list = document.createElement('ul');
  list.style.textAlign = 'left';
  list.style.margin = 'var(--gap-md) 0';
  for (const msg of messages) {
    const li = document.createElement('li');
    li.textContent = msg;
    list.appendChild(li);
  }
  panel.appendChild(list);

  const button = document.createElement('button');
  button.textContent = 'Reload';
  button.className = 'btn';
  button.addEventListener('click', () => {
    location.reload();
  });
  panel.appendChild(button);

  blocker.appendChild(panel);
  overlay.appendChild(blocker);
}
