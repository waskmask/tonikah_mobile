import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Text } from '@/components/ui/Text';
import { Config } from '@/constants/config';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';

function getGoogleConsentParts(consentStatement: string) {
    const match = consentStatement.match(/^(.*?)<a\b[^>]*>(.*?)<\/a>(.*?)<a\b[^>]*>(.*?)<\/a>(.*)$/i);
    if (!match) {
        return {
            beforeTerms: consentStatement,
            termsLabel: '',
            betweenLinks: '',
            privacyLabel: '',
            afterPrivacy: '',
        };
    }

    return {
        beforeTerms: match[1],
        termsLabel: match[2],
        betweenLinks: match[3],
        privacyLabel: match[4],
        afterPrivacy: match[5],
    };
}

export function GoogleConsentNotice() {
    const { t, isRTL } = useLanguage();
    const parts = getGoogleConsentParts(String(t('consent_statement_google')));

    const openTerms = () => WebBrowser.openBrowserAsync(Config.TERMS_URL);
    const openPrivacy = () => WebBrowser.openBrowserAsync(Config.PRIVACY_URL);

    return (
        <View style={[styles.wrap, { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap' }]}>
            <Text variant="caption" align="center" className="text-gray-500 dark:text-gray-400" style={styles.text}>
                {parts.beforeTerms}
            </Text>
            {parts.termsLabel ? (
                <Pressable onPress={openTerms} hitSlop={6}>
                    <Text variant="caption" align="center" className="text-[#4B68C4] font-body-semi underline" style={styles.link}>
                        {parts.termsLabel}
                    </Text>
                </Pressable>
            ) : null}
            {parts.betweenLinks ? (
                <Text variant="caption" align="center" className="text-gray-500 dark:text-gray-400" style={styles.text}>
                    {parts.betweenLinks}
                </Text>
            ) : null}
            {parts.privacyLabel ? (
                <Pressable onPress={openPrivacy} hitSlop={6}>
                    <Text variant="caption" align="center" className="text-[#4B68C4] font-body-semi underline" style={styles.link}>
                        {parts.privacyLabel}
                    </Text>
                </Pressable>
            ) : null}
            {parts.afterPrivacy ? (
                <Text variant="caption" align="center" className="text-gray-500 dark:text-gray-400" style={styles.text}>
                    {parts.afterPrivacy}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(10),
        paddingHorizontal: scale(4),
        gap: scale(2),
    },
    text: {
        fontSize: scale(11),
        lineHeight: scale(16),
    },
    link: {
        fontSize: scale(11),
        lineHeight: scale(16),
    },
});
