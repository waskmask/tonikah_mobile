import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getLocales } from 'expo-localization';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { CheckCircle, CheckSquare, Square } from 'phosphor-react-native';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { GradientButton } from '@/components/ui/GradientButton';
import { SingleSelectSheet } from '@/components/ui/SingleSelectSheet';
import { UnderlineTextInput } from '@/components/ui/UnderlineTextInput';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { t, translateCountry } from '@/lib/profileDisplay';
import { asciiDigits, canVerifyPhone, normalizeVerificationPhone, phoneErrorKey, readPhoneChallenge, secondsRemaining, type PhoneChallenge } from '@/lib/phoneVerification';

const copy = (key: string, options?: Record<string, unknown>) => t(`phone_verification.${key}`, undefined, options);

export default function PhoneVerificationScreen() {
    const user = useAuthStore((state) => state.user);
    // Account changes remount the flow rather than carrying a code into another session.
    return user ? <PhoneVerificationForm key={user._id} /> : null;
}

function PhoneVerificationForm() {
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { isRTL, currentLanguage } = useLanguage();
    const alive = useRef(true);
    const locked = useRef(false);
    const [busy, setBusy] = useState(false);
    const [country, setCountry] = useState<CountryCode>(() => {
        const stored = parsePhoneNumberFromString(user?.phone?.number || '')?.country;
        const region = getLocales()[0]?.regionCode as CountryCode;
        return stored || (getCountries().includes(region) ? region : 'US');
    });
    const [number, setNumber] = useState(user?.phone?.number || '');
    const [picker, setPicker] = useState(false);
    const [consent, setConsent] = useState(false);
    const [code, setCode] = useState('');
    const [challenge, setChallenge] = useState<PhoneChallenge | null>(null);
    const [retryAt, setRetryAt] = useState(0);
    const [now, setNow] = useState(Date.now());
    const [error, setError] = useState('');
    const [verified, setVerified] = useState<string | null>(user?.phone?.verified ? user.phone.number : null);
    const [editing, setEditing] = useState(false);
    const textStyle = { textAlign: isRTL ? 'right' as const : 'left' as const };
    const eligible = canVerifyPhone(user?.membership, now);
    const emailVerified = Boolean(user?.email_verified);
    const remaining = secondsRemaining(challenge?.expiresAt, now);
    const resend = secondsRemaining(Math.max(retryAt, Date.parse(challenge?.resendAt || '') || 0), now);
    const options = useMemo(() => getCountries().map((value) => ({
        value, label: `${translateCountry(value)} (+${getCountryCallingCode(value)})`,
    })).sort((a, b) => a.label.localeCompare(b.label, currentLanguage)), [currentLanguage]);

    useEffect(() => {
        alive.current = true;
        const tick = () => setNow(Date.now());
        const timer = setInterval(tick, 1000);
        const listener = AppState.addEventListener('change', (state) => {
            if (state === 'active') { tick(); void refreshUser(); }
        });
        return () => { alive.current = false; clearInterval(timer); listener.remove(); };
    }, [refreshUser]);
    useFocusEffect(useCallback(() => { void refreshUser(); }, [refreshUser]));

    const send = async () => {
        if (locked.current || !consent || !eligible || !emailVerified || resend > 0) return;
        const normalized = challenge?.number || normalizeVerificationPhone(number, country);
        if (!normalized) { setError('invalid_number'); return; }
        locked.current = true;
        setBusy(true); setError(''); setCode(''); setChallenge(null);
        setRetryAt(Date.now() + 60000);
        Keyboard.dismiss();
        try {
            const result = await api.post('/verification/phone/send', { phoneNumber: normalized }, { timeout: 25000 });
            if (!alive.current) return;
            const next = readPhoneChallenge(result, normalized);
            if (next) {
                setNumber(normalized); setChallenge(next); setNow(Date.now());
            } else {
                setError(phoneErrorKey(result.message));
                if (result.message === 'phone_already_verified') { setVerified(normalized); setEditing(false); void refreshUser(); }
            }
        } catch { if (alive.current) setError('network'); }
        finally { locked.current = false; if (alive.current) setBusy(false); }
    };

    const verify = async () => {
        if (locked.current || !challenge || remaining === 0 || !/^\d{6}$/.test(code)) return;
        locked.current = true; setBusy(true); setError('');
        try {
            const result = await api.post('/verification/phone/verify', { challengeId: challenge.challengeId, code });
            if (!alive.current) return;
            if (result.success && result.verified === true && result.number === challenge.number) {
                Keyboard.dismiss();
                setVerified(challenge.number); setEditing(false); setChallenge(null); setCode('');
                const state = useAuthStore.getState();
                if (state.user?._id === user?._id) {
                    state.setUser({ ...state.user!, phone: { number: result.number, verified: true } });
                    void refreshUser();
                }
            } else { setError(phoneErrorKey(result.message)); }
        } catch { if (alive.current) setError('network'); }
        finally { locked.current = false; if (alive.current) setBusy(false); }
    };

    const link = (title: string, onPress: () => void, disabled = false) => (
        <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
            accessibilityState={{ disabled }} style={[styles.link, { opacity: disabled ? 0.45 : 1 }]}>
            <Text variant="body-sm" className="font-body-bold" style={[textStyle, { color: colors.chrome.primary }]}>{title}</Text>
        </Pressable>
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={copy('title')} fallbackHref="/verifications" />
            <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={scale(16)}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + scale(16) }]}>
                {verified && !editing ? (
                    <View style={styles.group}>
                        <CheckCircle size={scale(32)} color={colors.chrome.primary} />
                        <Text variant="body" className="font-body-bold" style={textStyle}>{copy('verified')}</Text>
                        <Text variant="body" style={{ writingDirection: 'ltr', textAlign: 'left' }}>{verified}</Text>
                        {link(copy('change'), () => { setEditing(true); setConsent(false); setNumber(''); setError(''); })}
                    </View>
                ) : !eligible || !emailVerified ? (
                    <View style={styles.group}>
                        <Text variant="body-sm" style={textStyle}>{copy(!emailVerified ? 'email' : 'paid')}</Text>
                        {link(!emailVerified ? t('account_email', 'Account email') : t('membership_plans', 'Membership plans'),
                            () => router.push(!emailVerified ? '/settings-account' : '/memberships'))}
                    </View>
                ) : (
                    <View style={styles.group}>
                        {challenge ? <>
                            <Text variant="body-sm" style={textStyle}>{copy('sent', { number: challenge.number })}</Text>
                            <Text variant="body-sm" className="font-body-bold" style={textStyle}>{copy('code')}</Text>
                            <UnderlineTextInput accessibilityLabel={copy('code')} value={code}
                                onChangeText={(value) => { setCode(asciiDigits(value).replace(/\D/g, '').slice(0, 6)); setError(''); }}
                                keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
                                autoCorrect={false} maxLength={6} editable={!busy && remaining > 0}
                                style={styles.code} placeholder="000000" placeholderTextColor={colors.brand.text.muted}
                                onSubmitEditing={verify} />
                            <Text variant="body-sm" style={[textStyle, { color: colors.brand.text.subtitle }]}>
                                {remaining > 0 ? copy('expires', { time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` }) : copy('expired')}
                            </Text>
                            <GradientButton title={copy('verify')} onPress={verify} loading={busy}
                                disabled={busy || code.length !== 6 || remaining === 0} widthMode="full" />
                            {link(resend > 0 ? copy('resend_in', { seconds: resend }) : copy('resend'), send, busy || resend > 0)}
                            {link(copy('change'), () => { setChallenge(null); setCode(''); setError(''); setConsent(false); }, busy)}
                        </> : <>
                            <Text variant="body-sm" style={textStyle}>{copy('intro')}</Text>
                            <Text variant="body-sm" className="font-body-bold" style={textStyle}>{copy('country')}</Text>
                            {link(`${translateCountry(country)} (+${getCountryCallingCode(country)})`, () => { Keyboard.dismiss(); setPicker(true); }, busy)}
                            <Text variant="body-sm" className="font-body-bold" style={textStyle}>{copy('number')}</Text>
                            <UnderlineTextInput accessibilityLabel={copy('number')} value={number} keyboardType="phone-pad"
                                textContentType="telephoneNumber" autoComplete="tel" autoCorrect={false} maxLength={30}
                                onChangeText={(value) => { setNumber(value); setError(''); }} editable={!busy}
                                style={styles.number} placeholder={`+${getCountryCallingCode(country)}`}
                                placeholderTextColor={colors.brand.text.muted} />
                            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent, disabled: busy }}
                                accessibilityLabel={copy('consent')} onPress={() => setConsent(!consent)} disabled={busy}
                                style={[styles.consent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                {consent ? <CheckSquare size={24} color={colors.chrome.primary} /> : <Square size={24} color={colors.brand.text.muted} />}
                                <Text variant="body-sm" style={[textStyle, { flex: 1 }]}>{copy('consent')}</Text>
                            </Pressable>
                            <GradientButton title={resend > 0 ? copy('resend_in', { seconds: resend }) : copy('send')}
                                onPress={send} loading={busy} disabled={busy || !consent || !number.trim() || resend > 0} widthMode="full" />
                        </>}
                    </View>
                )}
                {error ? <Text accessibilityLiveRegion="polite" variant="body-sm"
                    style={[textStyle, styles.error, { color: colors.brand.accent.error }]}>{copy(error)}</Text> : null}
            </KeyboardAwareScrollView>
            <SingleSelectSheet visible={picker} onClose={() => setPicker(false)} selected={country}
                onSelect={(value) => { setCountry(value as CountryCode); setError(''); }} options={options}
                title={copy('country')} searchEnabled searchPlaceholder={t('search', 'Search')} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 }, content: { padding: scale(20) }, group: { gap: scale(16) },
    link: { minHeight: scale(44), justifyContent: 'center' },
    number: { writingDirection: 'ltr', textAlign: 'left', fontSize: scale(18) },
    code: { writingDirection: 'ltr', textAlign: 'left', fontSize: scale(24), lineHeight: scale(32) },
    consent: { alignItems: 'center', gap: scale(12), minHeight: scale(44) },
    error: { marginTop: scale(16) },
});
