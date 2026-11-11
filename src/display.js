export function setupDisplayControls() {
  const desktop = window.afterTheRainDesktop;
  const fullscreen = document.getElementById('fullscreen');
  const exit = document.getElementById('exit-game');
  const message = document.getElementById('window-message');
  const label = fullscreen.querySelector('span');
  const update = active => {
    label.textContent = active ? 'โหมดหน้าต่าง' : 'เต็มจอ';
  };
  const fullscreenError = () => {
    message.textContent = 'สลับโหมดเต็มจอไม่สำเร็จ ลองอีกครั้ง';
    message.hidden = false;
  };

  if (desktop) {
    exit.hidden = false;
    exit.addEventListener('click', () => desktop.close());
    fullscreen.querySelector('kbd').hidden = false;
    desktop.onFullscreenChange(update);
    desktop.getFullscreen().then(update, fullscreenError);
  } else {
    document.addEventListener('fullscreenchange', () => update(Boolean(document.fullscreenElement)));
  }
  fullscreen.hidden = !desktop && !document.fullscreenEnabled;

  fullscreen.addEventListener('click', async () => {
    message.hidden = true;
    try {
      if (desktop) update(await desktop.toggleFullscreen());
      else if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      fullscreenError();
    }
  });
}
