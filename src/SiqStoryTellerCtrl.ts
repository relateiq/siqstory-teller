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

function isElement(node: Node): node is Element {
    return (<Element>node).setAttribute !== undefined;
}

function isTextInput(node: Node): node is HTMLInputElement {
    return (<HTMLInputElement>node).value !== undefined;
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
        let nextFrameDelay = Math.min(Math.ceil(thisTwist.timeSincePageLoad - (lastTwist && lastTwist.timeSincePageLoad || 0)), 1000);
        setTimeout(function() {
            let twist = thisTwist;
            let targetNode = twist.targetNode && self.findNodeByNodeId(twist.targetNode.nodeId);
            switch (twist.type) {
                case 'childList':
                    if (twist.addedNodes) {
                        twist.addedNodes.forEach(function(storyNode: SiqStoryNode) {
                            if (!targetNode) {
                                console.warn('could not find targetNode for addition', JSON.stringify(twist.targetNode));
                                return;
                            }
                            let node = self.createNode(storyNode);
                            if (node) {
                                targetNode.appendChild(node);
                            } else if (storyNode.nodeType === 1 || storyNode.nodeType === 3) {
                                throw new Error('couldnt make node for element or text node');
                            }
                        });
                    }
                    if (twist.removedNodes) {
                        twist.removedNodes.forEach(function(storyNode: SiqStoryNode) {
                            if (!targetNode) {
                                console.log('could not find targetNode for removal', JSON.stringify(twist.targetNode));
                                return;
                            }
                            let removeNode;
                            if (storyNode.nodeType === 3) {
                                removeNode = self.findNodeByValue(storyNode.nodeValue, targetNode);
                                delete nodeIdToTextNode[storyNode.nodeId];
                            } else {
                                removeNode = self.findNodeByNodeId(storyNode.nodeId, targetNode);
                            }
                            if (removeNode) {
                                targetNode.removeChild(removeNode);
                            }

                        });
                    }
                    break;
                case 'attributes':
                    if (isElement(targetNode)) {
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
                            if (isTextInput(targetNode)) {
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
            var textNode = this.iframe.contentDocument.createTextNode(storyNode.nodeValue);
            textNode['__siqStoryNodeId'] = storyNode.nodeId;
            nodeIdToTextNode[storyNode.nodeId] = textNode;
            return textNode;
        }
        if (storyNode.nodeType === 1) {
            let node = (<Element>this.findNodeByNodeId(storyNode.nodeId));
            if (!node) {
                node = this.iframe.contentDocument.createElement(storyNode.tagName);
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

    findNodeByNodeId(nodeId, ancestorNode?: Element | Document): Element | Document {

        if (nodeId === 'document') {
            return this.iframe.contentDocument;
        }
        if (nodeId === 'body') {
            return this.iframe.contentDocument.body;
        }
        if (nodeId !== undefined) {
            ancestorNode = ancestorNode || this.iframe.contentDocument;
            return ancestorNode.querySelector('[siq-story-node-id="' + nodeId + '"]');
        }
    }
}
