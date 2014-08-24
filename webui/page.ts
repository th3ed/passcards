/// <reference path="../addons/firefox/typings/firefox-content-script.d.ts" />

// the page script which is injected into browser tabs
// to collect details of fill-able fields and auto-fill
// fields

import env = require('../lib/base/env');
import forms = require('../webui/forms');
import rpc = require('../lib/net/rpc');

var portRpc: rpc.RpcHandler;

if (env.isChromeExtension()) {
	portRpc = new rpc.RpcHandler(new rpc.ChromeMessagePort());
} else {
	var selfWorker: ContentWorker = <any>self;
	portRpc = new rpc.RpcHandler(selfWorker.port);
}

function inputFieldType(typeStr: string) : forms.FieldType {
	switch (typeStr.toLowerCase()) {
		case 'email':
			return forms.FieldType.Email;
		case 'password':
			return forms.FieldType.Password;
		case 'checkbox':
		case 'button':
		case 'radio':
			return forms.FieldType.Other;
		default:
			return forms.FieldType.Text;
	}
}

function isElementVisible(elt: Element) {
	var rect = elt.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}

var lastFields : HTMLInputElement[] = [];

portRpc.on('find-fields', () => {
	lastFields = [];

	var fieldElements = document.getElementsByTagName('input');
	var fields: forms.InputField[] = [];
	for (var i=0; i < fieldElements.length; i++) {
		var elt = fieldElements.item(i);
		lastFields.push(elt);

		var field : forms.InputField = {
			key: fields.length,
			id: elt.id,
			name: elt.name,
			type: inputFieldType(elt.type),
			placeholder: elt.placeholder,
			visible: isElementVisible(elt)
		};
		var ariaAttr = elt.attributes.getNamedItem('aria-label');
		if (ariaAttr) {
			field.ariaLabel = ariaAttr.value;
		}

		fields.push(field);
	}

	return fields;
});

portRpc.on('autofill', (entries: forms.AutoFillEntry[]) => {
	var filled = 0;

	entries.forEach((entry) => {
		if (typeof entry.key == 'number' && entry.key >= 0 && entry.key < lastFields.length) {
			var elt = lastFields[entry.key];
			elt.value = entry.value;
			++filled;
		}
	});

	return filled;
});
