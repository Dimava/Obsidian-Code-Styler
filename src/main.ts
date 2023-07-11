import { Plugin, MarkdownView, WorkspaceLeaf } from "obsidian";

import { DEFAULT_SETTINGS, LANGUAGE_ICONS_DATA, CodeStylerSettings } from './Settings';
import { SettingsTab } from "./SettingsTab";
import { removeStylesAndClasses, updateStyling } from "./ApplyStyling";
import { createCodeblockCodeMirrorExtensions } from "./EditingView";
import { destroyReadingModeElements, executeCodeMutationObserver, readingStylingMutationObserver, readingViewCodeblockDecoratingPostProcessor, readingViewInlineDecoratingPostProcessor } from "./ReadingView";

export default class CodeStylerPlugin extends Plugin {
	settings: CodeStylerSettings;
	readingStylingMutationObserver: MutationObserver;
	executeCodeMutationObserver: MutationObserver;
	languageIcons: Record<string,string>;
	
	async onload() {
		await this.loadSettings(); // Load Settings
		const settingsTab = new SettingsTab(this.app,this);
		this.addSettingTab(settingsTab);

		document.body.classList.add('code-styler'); // Load Styles
		updateStyling(this.settings,this.app);

		this.languageIcons = Object.keys(LANGUAGE_ICONS_DATA).reduce((result: {[key: string]: string}, key: string) => { // Load Icons
			result[key] = URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32">${LANGUAGE_ICONS_DATA[key]}</svg>`], { type: "image/svg+xml" }));
			return result
		},{})

		this.readingStylingMutationObserver = readingStylingMutationObserver; // Initialise reading view styling mutation observer
		this.executeCodeMutationObserver = executeCodeMutationObserver; // Add execute code mutation observer
		
		this.registerMarkdownPostProcessor(async (el,ctx) => {await readingViewCodeblockDecoratingPostProcessor(el,ctx,this)}) // Add codeblock decorating markdownPostProcessor
		this.registerMarkdownPostProcessor(async (el,ctx) => {await readingViewInlineDecoratingPostProcessor(el,ctx,this)}) // Add inline code decorating markdownPostProcessor

		let {codemirrorExtensions,collapseCommand} = createCodeblockCodeMirrorExtensions(this.settings,this.languageIcons);
		this.registerEditorExtension(codemirrorExtensions); // Add codemirror extensions

		this.registerEvent(this.app.workspace.on('css-change',()=>updateStyling(this.settings,this.app),this)); // Update styling on css changes

		this.addCommand({id: 'fold-all', name: 'Fold all codeblocks', callback: ()=>{
			//TODO Currently folds codeblocks without headers shown
			let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				if (activeView.getMode() === 'preview')
					activeView.contentEl.querySelectorAll(".markdown-reading-view .code-styler-collapsed").forEach((headerElement: HTMLElement)=>{headerElement.classList.remove('code-styler-collapsed')})
				else
					//@ts-expect-error Undocumented Obsidian API
					collapseCommand(activeView.editor.cm.docView.view,true);
			}
		}})

		this.app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => { // Add decoration on enabling of plugin
			if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview')
				leaf.view.previewMode.rerender(true);
		})

		console.log("Loaded plugin: Code Styler");
	}
	
	onunload() {
		this.readingStylingMutationObserver.disconnect();
		this.executeCodeMutationObserver.disconnect();
		removeStylesAndClasses();
		destroyReadingModeElements();
		for (const url of Object.values(this.languageIcons)) // Unload icons
			URL.revokeObjectURL(url);
		console.log("Unloaded plugin: Code Styler");
	}

	async loadSettings() {
		this.settings = Object.assign({}, structuredClone(DEFAULT_SETTINGS), await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.app.workspace.updateOptions();
		updateStyling(this.settings,this.app);
	}
}
