import {SiqStoryTwist} from 'siqstory-journalist/.src/types';
import {SiqStoryNode} from 'siqstory-journalist/.src/types';

let nodeIdToTextNode = {};

export class SiqStoryTellerCtrl {
    iframe: HTMLIFrameElement;
    storyIndex: number = 0;
    story: SiqStoryTwist[];
    constructor($element, LibrarySrvc) {
        var self = this;
        self.iframe = $element.find('iframe')[0];
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
        let nextFrameDelay = thisTwist.timeSincePageLoad - (lastTwist && lastTwist.timeSincePageLoad || 0);
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
