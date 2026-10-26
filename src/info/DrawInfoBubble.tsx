import { useInsertionEffect, type ReactNode } from 'react';
import { ensureInfoBubbleStyles, infoBubblePropsRule, type InfoBubbleStyleValues } from './infoBubbleStyles';

interface DrawInfoBubbleProps extends InfoBubbleStyleValues {
    /** Added to the bubble's class list, next to `mc-info-bubble`. */
    className?: string;
    children: ReactNode;
}

/**
 * The bubble itself: one div, its tail drawn by `::before` and `::after`.
 *
 * No style attribute anywhere, so an app's stylesheet reaches every part of it.
 * The look comes from `--mc-bubble-*` custom properties (see infoBubbleStyles);
 * a prop that is given wins over them, one that is left out leaves them in
 * charge. The children sit directly inside, so `.my-bubble h1` and
 * `.my-bubble > h1` both reach them and `color` set on the class is inherited.
 *
 * The tail hangs below the box, inside its bottom margin, so the element's
 * outer box ends at the tail's tip — which is where InfoBubbleOverlay puts the
 * anchor.
 */
export function DrawInfoBubble({ className, children, ...values }: DrawInfoBubbleProps) {
    const propsRule = infoBubblePropsRule(values);

    useInsertionEffect(() => {
        ensureInfoBubbleStyles();
        propsRule?.install();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propsRule?.className]);

    return (
        <div className={['mc-info-bubble', propsRule?.className, className].filter(Boolean).join(' ')}>
            {children}
        </div>
    );
}
