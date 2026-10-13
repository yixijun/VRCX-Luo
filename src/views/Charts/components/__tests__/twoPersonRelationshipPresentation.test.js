import {
    getInitiatorLabelKey,
    getInitiatorTooltipKey,
    getSelfPresenceLabelKey,
    getSelfPresenceTooltipKey
} from '../twoPersonRelationshipPresentation';

describe('two person relationship presentation', () => {
    it('describes a missing self record without claiming absence', () => {
        expect(getSelfPresenceLabelKey(false)).toBe('self_not_present');
        expect(getSelfPresenceTooltipKey(false)).toBe(
            'self_not_present_tooltip'
        );
        expect(getSelfPresenceLabelKey(true)).toBe('self_present');
        expect(getSelfPresenceTooltipKey(true)).toBe('self_present_tooltip');
    });

    it('keeps inferred join order labels explicit and handles unknown values', () => {
        expect(getInitiatorLabelKey('leftPlayer')).toBe('initiator_leftPlayer');
        expect(getInitiatorTooltipKey('rightPlayer')).toBe(
            'initiator_rightPlayer_tooltip'
        );
        expect(getInitiatorLabelKey('mutual')).toBe('initiator_mutual');
        expect(getInitiatorTooltipKey('snapshot')).toBe(
            'initiator_unknown_tooltip'
        );
    });
});
