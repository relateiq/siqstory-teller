import {SiqStoryTwist} from 'siqstory-journalist/.src/types';
import {SiqStoryNode} from 'siqstory-journalist/.src/types';

let nodeIdToTextNode = {};

class ClickBubble {
    downtime: number;
    element: HTMLElement;
    constructor() {
        var self = this;
        self.downtime = Date.now();
        self.element = document.createElement('div');
        self.element.classList.add('click-bubble');
        setTimeout(function() {
            self.element.classList.add('down');
        });
    }

    up() {
        var self = this;
        setTimeout(function() {
            self.element.classList.remove('down');
            if (self.element.parentNode) {
                self.element.parentNode.removeChild(self.element);
            }
        }, Math.max(100 - (Date.now() - this.downtime), 0))
    }
}

export class SiqStoryTellerCtrl {
    private iframe: HTMLIFrameElement;
    private element: HTMLElement;
    private pointer: HTMLElement;
    private storyIndex: number = 0;
    private story: SiqStoryTwist[];
    private currentClickBubble: ClickBubble;
    constructor($element, LibrarySrvc) {
        var self = this;
        self.iframe = $element.find('iframe')[0];
        self.element = $element.find('.story-teller')[0];
        self.pointer = $element.find('.story-teller-mouse-cursor')[0];
        // clear it out cause it's easier to go from the root
        self.iframe.contentDocument.removeChild(self.iframe.contentDocument.childNodes[0]);
        LibrarySrvc.getLatestStory().then(function(story: SiqStoryTwist[]) {
            self.story = story;
            self.playNextStoryFrame();
        });
    }

    playNextStoryFrame() {
        // put this in a timeout just to get freaking stack traces ANGULAR
        let self = this;
        let thisTwist = self.story[self.storyIndex];
        if (!thisTwist) {
            return;
        }
        let lastTwist = self.story[self.storyIndex - 1];
        let nextFrameDelay = Math.ceil(thisTwist.timeSincePageLoad - (lastTwist && lastTwist.timeSincePageLoad || 0));
        setTimeout(function() {
            let twist = thisTwist;
            let targetNode = self.findNodeByNodeId(twist.targetNode);
            switch (twist.type) {
                case 'childList':
                    if (twist.addedNodes) {
                        twist.addedNodes.forEach(function(storyNode: SiqStoryNode) {
                            let node = self.createNode(storyNode);
                            if (node) {
                                if (!targetNode) {
                                    console.warn('could not find targetNode for addition this could be bad.. but continuing');
                                } else {
                                    targetNode.appendChild(node);
                                }
                            } else if (storyNode.nodeType === 1 || storyNode.nodeType === 3) {
                                throw new Error('couldnt make node for element or text node');
                            }
                        });
                    }
                    if (twist.removedNodes) {
                        twist.removedNodes.forEach(function(storyNode: SiqStoryNode) {
                            let removeNode;
                            if (storyNode.nodeType === 3) {
                                removeNode = self.findNodeByValue(storyNode.nodeValue, targetNode);
                            } else {
                                removeNode = self.findNodeByNodeId(storyNode.nodeId, targetNode);
                            }
                            if (removeNode && targetNode) {
                                targetNode.removeChild(removeNode);
                            }
                        });
                    }
                    break;
                case 'attributes':
                    if (targetNode instanceof Element) {
                        targetNode.setAttribute(twist.attributeName, twist.attributeValue);
                    }
                    break;
                case 'resize':
                    self.element.style.width = (self.iframe.width = twist.width.toString()) + 'px';
                    self.element.style.height = (self.iframe.height = twist.height.toString()) + 'px';
                    break;
                case 'event':
                    switch (twist.eventType) {
                        case 'mousemove':
                            var top = twist.clientY + 'px';
                            var left = twist.clientX + 'px';
                            self.pointer.style.top = top;
                            self.pointer.style.left = left;
                            if (self.currentClickBubble) {
                                self.currentClickBubble.element.style.top = top;
                                self.currentClickBubble.element.style.left = left;
                            }

                            break;
                        case 'mousedown':
                            self.pointer.classList.add('mousedown');
                            var top = twist.clientY + 'px';
                            var left = twist.clientX + 'px';
                            self.currentClickBubble = new ClickBubble();
                            self.currentClickBubble.element.style.top = top;
                            self.currentClickBubble.element.style.left = left;
                            self.element.appendChild(self.currentClickBubble.element);
                            break;
                        case 'mouseup':
                            self.pointer.classList.remove('mousedown');
                            self.currentClickBubble.up();
                            self.currentClickBubble = null;
                            break;
                        case 'input':
                            if (targetNode instanceof HTMLInputElement || targetNode instanceof HTMLTextAreaElement) {
                                targetNode.value = twist.textValue;
                            }
                            break;
                    }
                    break;
            }
            self.storyIndex++;
            self.playNextStoryFrame();
        }, nextFrameDelay);
    }

    createNode(storyNode: SiqStoryNode): Node {
        if (storyNode.nodeType === 3) {
            if (nodeIdToTextNode[storyNode.nodeId]) {
                return nodeIdToTextNode[storyNode.nodeId];
            }
            var textNode = document.createTextNode(storyNode.nodeValue);
            textNode['__siqStoryNodeId'] = storyNode.nodeId;
            nodeIdToTextNode[storyNode.nodeId] = textNode;
            return textNode;
        }
        if (storyNode.nodeType === 1) {
            let node = (<Element>this.findNodeByNodeId(storyNode.nodeId));
            if (!node) {
                node = document.createElement(storyNode.tagName);
                node.setAttribute('siq-story-node-id', storyNode.nodeId);
                if (storyNode.attributes) {
                    Object.keys(storyNode.attributes).forEach(function(attributeName) {
                        if (attributeName === 'siqStoryCSS') {
                            node.innerHTML = storyNode.attributes[attributeName];
                        } else {
                            try {
                                node.setAttribute(attributeName, storyNode.attributes[attributeName]);
                            } catch (e) {
                                console.log('got weird attribute', attributeName, storyNode.attributes[attributeName])
                            }
                        }
                    });
                }
            }
            return node;
        }
    }

    findNodeByValue(value, targetNode): Node {
        return Array.prototype.slice.call(targetNode.childNodes).filter(function(node) {
            return node.nodeValue = value;
        })[0];
    }

    findNodeByNodeId(nodeId, targetNode?: Element | Document): Element | Document {

        if (nodeId === 'document') {
            return this.iframe.contentDocument;
        }
        if (nodeId === 'body') {
            return this.iframe.contentDocument.body;
        }
        if (nodeId !== undefined) {
            targetNode = targetNode || this.iframe.contentDocument;
            return targetNode.querySelector('[siq-story-node-id="' + nodeId + '"]');
        }
    }
}
