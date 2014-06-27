import argparse = require('argparse');
import Q = require('q');

import consoleio = require('./console');
import item_search = require('../lib/item_search');
import onepass = require('../lib/onepass');

var NO_SUCH_SECTION_ERROR = 'No matching section found';

export class EditCommand {
	private io: consoleio.TermIO;
	private passwordGenerator: () => string;

	parser: argparse.ArgumentParser;

	constructor(io: consoleio.TermIO, cmd: argparse.Subparsers, passwordGenerator: () => string) {
		this.io = io;
		this.passwordGenerator = passwordGenerator;

		this.parser = cmd.addParser('edit', {
			description: 'Edit an existing item in the vault'
		});
		this.parser.addArgument(['item'], {
			action: 'store',
			help: 'Pattern specifying the items'
		});
		var editCmds = this.parser.addSubparsers({dest:'action'});

		// commands for adding sections and fields
		var addSectionCmd = editCmds.addParser('add-section');
		addSectionCmd.addArgument(['section']);

		var addFieldCmd = editCmds.addParser('add-field');
		addFieldCmd.addArgument(['section']);
		addFieldCmd.addArgument(['field']);
		addFieldCmd.addArgument(['-t', '--type'], {
			action: 'store',
			nargs: 1,
			dest: 'type',
			help: 'Type of data for this item',
			default: 'text',
			choices: ['text', 'password']
		});
		addFieldCmd.addArgument(['value'], {
			action: 'store',
			nargs: '*'
		});

		// commands for updating sections and fields
		var renameSectionCmd = editCmds.addParser('rename-section');
		renameSectionCmd.addArgument(['section']);
		renameSectionCmd.addArgument(['new_name']);

		var setFieldCmd = editCmds.addParser('set-field');
		setFieldCmd.addArgument(['field']);
		setFieldCmd.addArgument(['value'], {
			action: 'store',
			nargs: '*'
		});

		var renameFieldCmd = editCmds.addParser('rename-field');
		renameFieldCmd.addArgument(['field']);
		renameFieldCmd.addArgument(['new_name']);

		// commands for removing sections and fields
		var removeSectionCmd = editCmds.addParser('remove-section');
		removeSectionCmd.addArgument(['section']);

		var removeFieldCmd = editCmds.addParser('remove-field');
		removeFieldCmd.addArgument(['field']);
	}

	handle(args: any, item: onepass.Item) : Q.Promise<void> {
		var content : onepass.ItemContent;
		return item.getContent().then((_content) => {
			content = _content;
			switch (args.action) {
				case 'add-section':
					return this.addSection(content, args.section);
				case 'add-field':
					return this.addField(content, args.section, args.field, args.type, args.value.join(' '));
				case 'rename-section':
					return this.renameSection(content, args.section, args.new_name);
				case 'set-field':
					return this.setField(content, args.field, args.value.join(' '));
				case 'rename-field':
					return this.renameField(content, args.field, args.new_name);
				case 'remove-section':
					return this.removeSection(content, args.section);
				case 'remove-field':
					return this.removeField(content, args.field);
			}
		}).then(() => {
			item.setContent(content);
			return item.save();
		});
	}

	private selectField(content: onepass.ItemContent, field: string) : item_search.FieldMatch {
		var matches = item_search.matchField(content, field);
		return matches.length > 0 ? matches[0] : null;
	}

	private addSection(content: onepass.ItemContent, sectionTitle: string) : Q.Promise<void> {
		var section = new onepass.ItemSection;
		section.name = sectionTitle;
		section.title = sectionTitle;
		content.sections.push(section);
		return null;
	}

	private addField(content: onepass.ItemContent, sectionName: string, fieldTitle: string, typeName: string,
	  value: string) : Q.Promise<void> {
		var sections = item_search.matchSection(content, sectionName);
		if (sections.length == 0) {
			return Q.reject(NO_SUCH_SECTION_ERROR);
		}

		var fieldTypes : { [index: string] : onepass.FieldType } = {
			'text' : onepass.FieldType.Text,
			'password' : onepass.FieldType.Password
		};

		var section = sections[0];
		var field = new onepass.ItemField();
		field.kind = fieldTypes[typeName];
		field.title = fieldTitle;
		field.value = value;

		section.fields.push(field);

		return null;
	}

	private renameSection(content: onepass.ItemContent, section: string, newName: string) : Q.Promise<void> {
		return Q.reject(null);
	}

	private setField(content: onepass.ItemContent, field: string, newValue: string) : Q.Promise<void> {
		var match = this.selectField(content, field);
		if (match) {
			if (newValue) {
				match.setValue(newValue);
				return Q.resolve<void>(null);
			} else {
				var newValPromise : Q.Promise<string>;
				if (match.isPassword()) {
					newValPromise = consoleio.passwordFieldPrompt(this.io, this.passwordGenerator);
				} else {
					newValPromise = this.io.readLine('New Value >');
				}
				return newValPromise.then((newValue) => {
					match.setValue(newValue);
					return Q.resolve<void>(null);
				});
			}
		} else {
			return Q.reject('No matching field found');
		}
	}

	private renameField(content: onepass.ItemContent, field: string, newName: string) : Q.Promise<void> {
		var match = this.selectField(content, field);
		if (match) {
			match.setName(newName);
			return Q.resolve<void>(null);
		} else {
			return Q.reject('No matching field found');
		}
	}

	private removeSection(content: onepass.ItemContent, section: string) : Q.Promise<void> {
		return Q.reject(null);
	}

	private removeField(content: onepass.ItemContent, field: string) : Q.Promise<void> {
		return Q.reject(null);
	}
}
