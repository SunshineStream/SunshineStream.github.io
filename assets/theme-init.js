// Apply an explicit preference before styles paint; otherwise CSS follows the device theme.
try {
  const preference = localStorage.getItem('sunshine-theme');
  if (preference === 'light' || preference === 'dark') {
    document.documentElement.dataset.theme = preference;
  }
} catch {
  // A blocked storage API must not prevent the page from rendering.
}
