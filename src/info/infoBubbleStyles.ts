/**
 * The info bubble's look, as a stylesheet rather than style attributes.
 *
 * Everything the bubble draws is CSS on one element and its two pseudo-elements,
 * so an app can restyle all of it — tail and corners included — from its own
 * stylesheet, through these custom properties:
 *
 *   --mc-bubble-color          fill                 (#ffffff)
 *   --mc-bubble-border-color   outline              (#000000)
 *   --mc-bubble-border-width   outline width        (2px)
 *   --mc-bubble-padding        space around content (8px)
 *   --mc-bubble-corner-radius  corner radius        (4px)
 *   --mc-bubble-tail-size      tail height and base (8px)
 *
 * Lengths need a unit. The defaults are fallbacks rather than declarations, so a
 * value set on any ancestor — `:root` included — reaches the bubble.
 *
 * The rules are one class strong (`.mc-info-bubble`), and the stylesheet goes
 * first in <head>. So an app's own class wins — same strength, later — while a
 * reset such as `* { margin: 0; padding: 0 }` does not: `*` has no specificity,
 * and when these rules were inside `:where()` (none either) a reset loaded
 * after them took the bubble's padding and the margin its tail hangs in.
 */

const BASE_ID = 'mapconductor-info-bubble';
const PROPS_ID = 'mapconductor-info-bubble-props';

const COLOR = 'var(--mc-bubble-color, #ffffff)';
const BORDER_COLOR = 'var(--mc-bubble-border-color, #000000)';
const BORDER_WIDTH = 'var(--mc-bubble-border-width, 2px)';
const TAIL = 'var(--mc-bubble-tail-size, 8px)';
// The fill triangle sits inside the outline triangle with BORDER_WIDTH between
// their slanted edges. The tail's sides rise 2:1, so that distance moves the
// apex up by √5 × BORDER_WIDTH; starting BORDER_WIDTH higher, to cover the
// body's bottom border, leaves a fill (√5 − 1) × BORDER_WIDTH shorter.
const TAIL_FILL = `max(0px, calc(${TAIL} - 1.236 * ${BORDER_WIDTH}))`;

const BASE_CSS = `
.mc-info-bubble {
    position: relative;
    box-sizing: border-box;
    margin: 0 0 ${TAIL};
    padding: var(--mc-bubble-padding, 8px);
    background: ${COLOR};
    border: ${BORDER_WIDTH} solid ${BORDER_COLOR};
    border-radius: var(--mc-bubble-corner-radius, 4px);
}
.mc-info-bubble::before,
.mc-info-bubble::after {
    content: '';
    position: absolute;
    left: 50%;
    width: 0;
    height: 0;
    border-style: solid;
    border-color: transparent;
    border-bottom-width: 0;
    transform: translateX(-50%);
    pointer-events: none;
}
.mc-info-bubble::before {
    top: calc(100% + ${BORDER_WIDTH});
    border-top-width: ${TAIL};
    border-left-width: calc(${TAIL} / 2);
    border-right-width: calc(${TAIL} / 2);
    border-top-color: ${BORDER_COLOR};
}
.mc-info-bubble::after {
    top: 100%;
    border-top-width: ${TAIL_FILL};
    border-left-width: calc(${TAIL_FILL} / 2);
    border-right-width: calc(${TAIL_FILL} / 2);
    border-top-color: ${COLOR};
}
`;

function sheetFor(id: string, css = ''): CSSStyleSheet | null {
    if (typeof document === 'undefined') return null;
    let element = document.getElementById(id) as HTMLStyleElement | null;
    if (!element) {
        element = document.createElement('style');
        element.id = id;
        element.textContent = css;
        // First in <head>: an app's own stylesheets come later and, at equal
        // specificity, win.
        document.head.prepend(element);
    }
    return element.sheet;
}

/** Puts the bubble's stylesheet in the document, once. */
export function ensureInfoBubbleStyles(): void {
    sheetFor(BASE_ID, BASE_CSS);
}

export interface InfoBubbleStyleValues {
    bubbleColor?: string;
    borderColor?: string;
    borderWidth?: number;
    contentPadding?: number;
    cornerRadius?: number;
    tailSize?: number;
}

const PROPERTIES: Array<[keyof InfoBubbleStyleValues, string]> = [
    ['bubbleColor', '--mc-bubble-color'],
    ['borderColor', '--mc-bubble-border-color'],
    ['borderWidth', '--mc-bubble-border-width'],
    ['contentPadding', '--mc-bubble-padding'],
    ['cornerRadius', '--mc-bubble-corner-radius'],
    ['tailSize', '--mc-bubble-tail-size'],
];

export interface InfoBubblePropsRule {
    /** Added to the bubble's class list. */
    readonly className: string;
    /** Puts the rule in the document, once. Call from useInsertionEffect. */
    readonly install: () => void;
}

/** Classes whose rule is already in the document. */
const installed = new Set<string>();

function hash(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}

/**
 * The rule that carries the values given as props, or null when none were.
 *
 * Props are the cross-platform way to style a bubble, and without a style
 * attribute they have to become a rule. One rule per distinct set of values,
 * kept for the page's lifetime: an app has a handful of bubble styles, not one
 * per bubble. The class name is a hash of the values, so it is the same on the
 * server and in the browser.
 *
 * The rule is `.mc-info-bubble.<class>`, two classes, so a value passed as a
 * prop beats one an app sets with a single class. Leave a prop out to style it
 * from CSS.
 */
export function infoBubblePropsRule(values: InfoBubbleStyleValues): InfoBubblePropsRule | null {
    const entries = PROPERTIES.flatMap(([key, property]) => {
        const value = values[key];
        if (value === undefined) return [];
        return [[property, typeof value === 'number' ? `${value}px` : value] as const];
    });
    if (entries.length === 0) return null;

    const className = `mc-info-bubble--${hash(entries.map(([property, value]) => `${property}:${value}`).join(';'))}`;
    return {
        className,
        install: () => {
            if (installed.has(className)) return;
            const sheet = sheetFor(PROPS_ID);
            if (!sheet) return;
            installed.add(className);
            const index = sheet.insertRule(`.mc-info-bubble.${className} {}`, sheet.cssRules.length);
            const rule = sheet.cssRules[index] as CSSStyleRule;
            // setProperty rather than text between the braces: a value is parsed
            // as a value and cannot close the rule and start another.
            for (const [property, value] of entries) rule.style.setProperty(property, value);
        },
    };
}
