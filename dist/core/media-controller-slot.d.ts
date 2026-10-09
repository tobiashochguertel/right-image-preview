import { MediaCapabilities, MediaController, MediaViewState, ViewerCommand } from './media-contract';
/**
 * Stable Shell-side command target. A renderer attaches its controller and receives
 * a generation-safe detach callback; late cleanup from an old renderer cannot detach
 * the controller that replaced it.
 */
export declare class MediaControllerSlot {
    private controller;
    private generation;
    attach(controller: MediaController): () => void;
    execute(command: ViewerCommand): boolean;
    getCapabilities(): MediaCapabilities;
    getViewState(): MediaViewState;
    get attached(): boolean;
}
