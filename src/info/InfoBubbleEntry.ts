import type { ReactNode } from 'react';
import type { GeoPoint, MarkerIcon, Offset } from '@mapconductor/js-sdk-core';

export interface InfoBubbleEntry {
    readonly id: string;
    readonly positionProvider: () => GeoPoint;
    readonly markerId?: string | null;
    readonly icon: MarkerIcon | null;
    readonly tailOffset: Offset;
    readonly content: ReactNode;
}
