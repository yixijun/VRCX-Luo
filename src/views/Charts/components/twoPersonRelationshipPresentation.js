const SELF_PRESENCE_LABEL_KEYS = Object.freeze({
    present: 'self_present',
    notRecorded: 'self_not_present'
});

const SELF_PRESENCE_TOOLTIP_KEYS = Object.freeze({
    present: 'self_present_tooltip',
    notRecorded: 'self_not_present_tooltip'
});

const INITIATOR_LABEL_KEYS = Object.freeze({
    leftPlayer: 'initiator_leftPlayer',
    rightPlayer: 'initiator_rightPlayer',
    mutual: 'initiator_mutual',
    unknown: 'initiator_unknown'
});

const INITIATOR_TOOLTIP_KEYS = Object.freeze({
    leftPlayer: 'initiator_leftPlayer_tooltip',
    rightPlayer: 'initiator_rightPlayer_tooltip',
    mutual: 'initiator_mutual_tooltip',
    unknown: 'initiator_unknown_tooltip'
});

export function getSelfPresenceLabelKey(isPresent) {
    return isPresent
        ? SELF_PRESENCE_LABEL_KEYS.present
        : SELF_PRESENCE_LABEL_KEYS.notRecorded;
}

export function getSelfPresenceTooltipKey(isPresent) {
    return isPresent
        ? SELF_PRESENCE_TOOLTIP_KEYS.present
        : SELF_PRESENCE_TOOLTIP_KEYS.notRecorded;
}

export function getInitiatorLabelKey(initiator) {
    return INITIATOR_LABEL_KEYS[initiator] || INITIATOR_LABEL_KEYS.unknown;
}

export function getInitiatorTooltipKey(initiator) {
    return INITIATOR_TOOLTIP_KEYS[initiator] || INITIATOR_TOOLTIP_KEYS.unknown;
}
