'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

function serviceRunning() {
	return L.resolveDefault(callServiceList('homebox'), {}).then(function(res) {
		var instances = (res['homebox'] || {}).instances || {};
		var name;

		for (name in instances)
			if (instances[name].running)
				return true;

		return false;
	});
}

/*
 * iframe auto sizing. The embedded homebox page is served from another origin,
 * so it cannot be measured from here; it reports its rendered height instead
 * (see the embed-height.js script shipped by the homebox package) and we apply
 * it with a lower bound. Resizing the frame does not change the reported value,
 * so this cannot oscillate.
 */
var MIN_EMBED_HEIGHT = 340;
/* at <= 719px homebox renders its advanced config as a dialog sized in vh */
var MIN_EMBED_HEIGHT_NARROW = 560;
var reportedEmbedHeight = 0;

function embedHeight() {
	var min = (window.innerWidth <= 719) ? MIN_EMBED_HEIGHT_NARROW : MIN_EMBED_HEIGHT;

	return Math.max(min, reportedEmbedHeight);
}

function applyEmbedHeight() {
	var node = document.getElementById('homebox-embed');
	var frame = node ? node.querySelector('iframe') : null;

	if (frame != null)
		frame.style.height = embedHeight() + 'px';
}

window.addEventListener('message', function(ev) {
	var data = ev.data;

	if (data == null || data.type != 'homebox:height' || !(data.height > 0))
		return;

	reportedEmbedHeight = Math.ceil(data.height);
	applyEmbedHeight();
});

window.addEventListener('resize', applyEmbedHeight);

return view.extend({
	load: function() {
		return uci.load('homebox');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('homebox', _('Homebox'),
			_('Homebox 提供基于浏览器的 Ping / 下载 / 上传测速，可用于压测千兆及万兆链路。' +
			  '服务默认关闭，仅在需要测速时打开。'));

		/*
		 * The status and embed widgets are emitted through the form machinery (a
		 * section with a custom render) instead of being appended to the rendered
		 * map node, so they are recreated on a form reset/re-render. The polling
		 * callback looks the elements up by id for the same reason.
		 *
		 * Note that form.Map#render() resolves to a Promise<Node>, so its result
		 * must not be passed through E() - that would append a "[object Promise]"
		 * text node and drop the whole form, including the switch.
		 */

		/* status comes first, it is what one wants to see at a glance */
		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = L.bind(function() {
			this._refresh = this._refresh || L.bind(this.refreshStatus, this);
			poll.add(this._refresh);

			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('运行状态')),
				E('p', { 'id': 'homebox-status' }, _('检测中…'))
			]);
		}, this);

		/* NamedSection honours `hidetitle`, `anonymous` is only used by
		   TypedSection, so leaving it unset renders the title as intended. */
		s = m.section(form.NamedSection, 'config', 'homebox', _('服务设置'));

		o = s.option(form.Flag, 'enabled', _('启用 Homebox 服务'),
			_('打开后点击“保存并应用”，服务会立即启动；关闭后服务停止，不再监听端口。'));
		o.rmempty = false;
		o.default = '0';

		o = s.option(form.Value, 'host', _('监听地址'),
			_('测速客户端需要能直接访问该地址，通常保持 0.0.0.0 即可。'));
		o.default = '0.0.0.0';
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('监听端口'),
			_('测速页面通过 http://路由器地址:端口/ 访问。'));
		o.datatype = 'port';
		o.default = '3300';
		o.rmempty = false;

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = L.bind(function() {
			var embedEl = E('div', { 'id': 'homebox-embed' });

			/* paint the state that does not depend on the service */
			this.renderEmbed(embedEl, null);

			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('测速页面')),
				embedEl
			]);
		}, this);

		return m.render().then(L.bind(function(formEl) {
			/* poll.add() already ticked once, while the form was not part of the
			   document yet, so refresh once more after it got attached. */
			if (this._refresh)
				window.setTimeout(this._refresh, 0);

			return formEl;
		}, this));
	},

	refreshStatus: function() {
		var statusEl = document.getElementById('homebox-status');
		var embedEl = document.getElementById('homebox-embed');

		/* the poll may tick before the form has been inserted into the document */
		if (statusEl == null || embedEl == null)
			return Promise.resolve();

		return serviceRunning().then(L.bind(function(running) {
			statusEl.innerHTML = _('运行状态：') + (running
				? '<span style="color:#2e7d32"><strong>%s</strong></span>'.format(_('运行中'))
				: '<span style="color:#c62828"><strong>%s</strong></span>'.format(_('未运行')));

			this.renderEmbed(embedEl, running);
		}, this));
	},

	renderEmbed: function(node, running) {
		var enabled = uci.get('homebox', 'config', 'enabled') == '1';
		var port = uci.get('homebox', 'config', 'port') || '3300';
		/* homebox only speaks plain HTTP, so the page has to be opened over
		   HTTP as well for the embedded frame to load. */
		var url = 'http://' + window.location.hostname + ':' + port + '/';

		if (!enabled) {
			this.setEmbedMessage(node,
				_('Homebox 当前已关闭。打开上方“启用 Homebox 服务”开关并点击“保存并应用”后，测速页面会显示在这里。'));
			return;
		}

		if (!running) {
			this.setEmbedMessage(node,
				_('Homebox 已启用但服务尚未就绪，请稍候；若长时间如此请查看系统日志。'));
			return;
		}

		if (node.getAttribute('data-url') == url && node.firstElementChild)
			return;

		node.innerHTML = '';
		node.removeAttribute('data-message');
		node.setAttribute('data-url', url);
		node.appendChild(E('p', {}, [
			E('a', {
				'href': url,
				'target': '_blank',
				'rel': 'noopener noreferrer'
			}, _('在新标签页打开测速页面')),
			' ',
			E('small', {}, [ '(' + url + ')' ])
		]));
		node.appendChild(E('iframe', {
			'src': url,
			'load': applyEmbedHeight,
			'style': 'width:100%; height:' + embedHeight() + 'px; border:1px solid #ccc; border-radius:4px; background:#fff;'
		}));
	},

	setEmbedMessage: function(node, text) {
		if (node.getAttribute('data-message') == text)
			return;

		node.innerHTML = '';
		node.removeAttribute('data-url');
		node.setAttribute('data-message', text);
		node.appendChild(E('div', { 'class': 'alert-message warning' }, [ text ]));
	}
});
