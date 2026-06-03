if (window.location.protocol !== 'file:' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('W-Light service worker registration failed', error)
    })
  })
}
