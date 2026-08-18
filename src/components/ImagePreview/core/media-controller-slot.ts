import {
  NO_MEDIA_CAPABILITIES,
  type MediaCapabilities,
  type MediaController,
  type MediaViewState,
  type ViewerCommand,
} from './media-contract';

/**
 * Stable Shell-side command target. A renderer attaches its controller and receives
 * a generation-safe detach callback; late cleanup from an old renderer cannot detach
 * the controller that replaced it.
 */
export class MediaControllerSlot {
  private controller: MediaController | null = null;
  private generation = 0;

  attach(controller: MediaController): () => void {
    this.controller = controller;
    const attachedGeneration = ++this.generation;
    return () => {
      if (this.generation !== attachedGeneration || this.controller !== controller) return;
      this.controller = null;
      this.generation += 1;
    };
  }

  execute(command: ViewerCommand): boolean {
    const controller = this.controller;
    if (!controller) return false;
    controller.execute(command);
    return true;
  }

  getCapabilities(): MediaCapabilities {
    return this.controller?.getCapabilities() ?? NO_MEDIA_CAPABILITIES;
  }

  getViewState(): MediaViewState {
    return this.controller?.getViewState() ?? {};
  }

  get attached(): boolean {
    return this.controller !== null;
  }
}
