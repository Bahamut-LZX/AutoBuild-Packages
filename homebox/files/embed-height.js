/*
 * Report the rendered page height to the embedding page.
 *
 * The LuCI app embeds this UI in an <iframe> served from a different origin
 * (its own port), so the parent cannot measure the content itself and would
 * have to use a fixed iframe height: too small clips the UI, too large wastes
 * screen space. The height also changes with the selected test mode and with
 * the advanced config panel, so reporting it keeps the frame snug.
 *
 * Does nothing when the page is opened directly.
 */
(function () {
	if (window.parent === window)
		return;

	var lastHeight = 0;

	function report() {
		var height = document.body ? document.body.scrollHeight : 0;

		/* only report actual changes, no matter which path triggered us */
		if (!height || height === lastHeight)
			return;

		lastHeight = height;

		try {
			window.parent.postMessage({ type: 'homebox:height', height: height }, '*');
		} catch (e) {
			/* ignore (e.g. sandboxed parent) */
		}
	}

	/* the layout needs a few frames to settle (fonts, charts, animations) */
	function reportSoon() {
		report();
		window.setTimeout(report, 120);
		window.setTimeout(report, 400);
	}

	window.addEventListener('load', reportSoon);
	window.addEventListener('resize', reportSoon);

	if (window.ResizeObserver && document.body)
		new ResizeObserver(report).observe(document.body);

	/*
	 * ResizeObserver notifications are tied to the rendering lifecycle, so they
	 * are not delivered while the page is not painting (background tab, hidden
	 * webview, ...). Poll as a fallback; report() is a no-op unless the height
	 * actually changed, so this is cheap.
	 */
	window.setInterval(report, 1000);
})();
