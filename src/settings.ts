import type { CanvasKeyboardPan, CanvasKeyboardPanSettings } from "./plugin";
import { DEFAULT_SETTINGS, Direction } from "./plugin";
import { Notice, PluginSettingTab, Setting, setIcon } from "obsidian";

import type { App } from "obsidian";

const KeyLabelOverrides: Record<string, string> = {
	ArrowUp: "Up",
	ArrowLeft: "Left",
	ArrowDown: "Down",
	ArrowRight: "Right",
};

export class CanvasKeyboardPanSettingsTab extends PluginSettingTab {
	keySettingsListener: ((evt: KeyboardEvent) => void) | null = null;
	keySettingsDocument: Document | null = null;
	activeDirection: Direction | null = null;
	keys: Partial<CanvasKeyboardPanSettings["keys"]> = {};

	public constructor(
		public app: App,
		public plugin: CanvasKeyboardPan,
	) {
		super(app, plugin);
	}

	public display() {
		this.stopKeyCapture();
		this.containerEl.empty();
		const keyboardViewContainer = this.containerEl.createDiv();
		keyboardViewContainer.appendChild(this.renderKeyboardView(this.plugin.settings.keys, null));
		new Setting(this.containerEl)
			.setName("Controls")
			.setDesc("Which set of keys pan the canvas.")
			.addExtraButton((button) => {
				button.setIcon("rotate-ccw");
				button.setTooltip("Restore default");
				button.onClick(async () => {
					this.plugin.settings.keys = { ...DEFAULT_SETTINGS.keys };
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				});
			})
			.addButton((button) => {
				button.setButtonText("Update controls");
				button.onClick(() => {
					this.stopKeyCapture();
					this.activeDirection = Direction.North;
					this.keys = {};
					keyboardViewContainer.empty();
					keyboardViewContainer.appendChild(this.renderKeyboardView(this.keys, this.activeDirection));
					const listener = ((evt: KeyboardEvent) => {
						if (this.activeDirection === null || evt.repeat || evt.ctrlKey || evt.altKey || evt.metaKey
							|| evt.code === "ShiftLeft" || evt.code === "ShiftRight") {
							return;
						}

						this.keys[this.activeDirection] = evt.code;
						switch (this.activeDirection) {
							case Direction.North:
								this.activeDirection = Direction.West;
								break;
							case Direction.West:
								this.activeDirection = Direction.South;
								break;
							case Direction.South:
								this.activeDirection = Direction.East;
								break;
							case Direction.East:
								this.activeDirection = null;
								void this.saveKeys(this.keys);
								break;
						}
						keyboardViewContainer.empty();
						keyboardViewContainer.appendChild(this.renderKeyboardView(this.keys, this.activeDirection));
					}).bind(this);
					this.keySettingsListener = listener;
					this.keySettingsDocument = this.containerEl.ownerDocument;
					this.keySettingsDocument.addEventListener("keydown", listener);
				});
			});

		new Setting(this.containerEl)
			.setName("Maximum pan speed")
			.setDesc("Canvas units to pan by")
			.addExtraButton((button) => {
				button.setIcon("rotate-ccw");
				button.setTooltip("Restore default");
				button.onClick(async () => {
					this.plugin.settings.maxSpeed = DEFAULT_SETTINGS.maxSpeed;
					await this.plugin.saveData(this.plugin.settings);
					this.display();
				});
			})
			.addSlider((slider) => {
				const displayValue = createSpan({ text: this.plugin.settings.maxSpeed.toString() });
				slider.sliderEl.parentElement?.prepend(displayValue);
				slider.setLimits(50, 500, 10);
				slider.setValue(this.plugin.settings.maxSpeed);
				slider.onChange((value) => {
					displayValue.setText(value.toString());
					this.plugin.settings.maxSpeed = value;
					void this.plugin.saveData(this.plugin.settings);
				});
			});
	}

	public async saveKeys(keys: Partial<CanvasKeyboardPanSettings["keys"]>): Promise<void> {
		if (!keys[Direction.North] || !keys[Direction.West] || !keys[Direction.South] || !keys[Direction.East]) {
			return;
		}
		const values = [keys[Direction.North], keys[Direction.West], keys[Direction.South], keys[Direction.East]];
		if (new Set(values.map((value) => value.toLowerCase())).size !== values.length) {
			new Notice("Canvas Keyboard Pan：四个方向键不能重复");
			this.stopKeyCapture();
			this.display();
			return;
		}
		this.plugin.settings = {
			...this.plugin.settings,
			keys: { ...(keys as Required<CanvasKeyboardPanSettings["keys"]>) },
		};
		await this.plugin.saveData(this.plugin.settings);
		this.stopKeyCapture();
		this.display();
	}

	public hide(): void {
		this.stopKeyCapture();
		super.hide();
	}

	private stopKeyCapture(): void {
		if (this.keySettingsListener && this.keySettingsDocument) {
			this.keySettingsDocument.removeEventListener("keydown", this.keySettingsListener);
		}
		this.keySettingsListener = null;
		this.keySettingsDocument = null;
		this.activeDirection = null;
	}

	public renderKeyboardView(
		keys: Partial<CanvasKeyboardPanSettings["keys"]>,
		activeKey: Direction | null,
	): HTMLElement {
		const container = createDiv({ cls: "pan-kb-mapping-container" });

		// Create icons
		const icons: Record<Direction, HTMLDivElement> = {
			[Direction.North]: container.createDiv({ cls: ["pan-kb", "pan-kb-north"] }),
			[Direction.West]: container.createDiv({ cls: ["pan-kb", "pan-kb-west"] }),
			[Direction.South]: container.createDiv({ cls: ["pan-kb", "pan-kb-south"] }),
			[Direction.East]: container.createDiv({ cls: ["pan-kb", "pan-kb-east"] }),
		};
		setIcon(icons.north, "lucide-arrow-up-square");
		setIcon(icons.west, "lucide-arrow-left-square");
		setIcon(icons.south, "lucide-arrow-down-square");
		setIcon(icons.east, "lucide-arrow-right-square");

		// Create labels
		const labels: Record<Direction, HTMLDivElement> = {
			[Direction.North]: container.createDiv({
				cls: ["pan-kb-label", "pan-kb-label-north"],
				text: this.getKeyLabel(keys, Direction.North),
			}),
			[Direction.West]: container.createDiv({
				cls: ["pan-kb-label", "pan-kb-label-west"],
				text: this.getKeyLabel(keys, Direction.West),
			}),
			[Direction.South]: container.createDiv({
				cls: ["pan-kb-label", "pan-kb-label-south"],
				text: this.getKeyLabel(keys, Direction.South),
			}),
			[Direction.East]: container.createDiv({
				cls: ["pan-kb-label", "pan-kb-label-east"],
				text: this.getKeyLabel(keys, Direction.East),
			}),
		};

		// Set active
		if (activeKey !== null) {
			icons[activeKey].classList.add("active");
			labels[activeKey].classList.add("active");
		}

		return container;
	}

	public getKeyLabel(keys: Partial<CanvasKeyboardPanSettings["keys"]>, direction: Direction): string {
		const key = keys[direction] ?? "?";
		if (KeyLabelOverrides[key]) return KeyLabelOverrides[key];
		if (key.startsWith("Key") && key.length === 4) return key.slice(3);
		if (key.startsWith("Digit")) return key.slice(5);
		return key;
	}
}
