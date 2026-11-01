'use strict';

// Copy buttons. The site reads without it.

(function() {

	const html = document.documentElement;
	const label = html.getAttribute('data-copy-label') || 'Copy';
	const copied = html.getAttribute('data-copied-label') || 'Copied';

	document.querySelectorAll('.code, [data-copy]').forEach(function(block) {

		const source = block.hasAttribute('data-copy') ? block.getAttribute('data-copy') : null;
		const button = document.createElement('button');

		button.type = 'button';
		button.className = 'copy';
		button.textContent = label;
		button.setAttribute('aria-label', label);

		button.addEventListener('click', function() {
			const text = source !== null ? source : block.querySelector('code').textContent;
			const done = function() {
				button.textContent = copied;
				setTimeout(function() { button.textContent = label; }, 1600);
			};
			if (navigator.clipboard)
				navigator.clipboard.writeText(text).then(done, function() {});
		});

		block.appendChild(button);
	});

})();
