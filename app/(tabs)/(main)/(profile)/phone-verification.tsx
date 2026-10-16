import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getLocales } from 'expo-localization';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { CaretDown, PencilSimple, SealCheck } from 'phosphor-react-native';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { GradientButton } from '@/components/ui/GradientButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { SingleSelectSheet } from '@/components/ui/SingleSelectSheet';
import { UnderlineTextInput } from '@/components/ui/UnderlineTextInput';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { t, translateCountry } from '@/lib/profileDisplay';
import { asciiDigits, defaultPhoneCountry, normalizeVerificationPhone, phoneInput, phoneErrorKey, readPhoneChallenge, secondsRemaining, type PhoneChallenge } from '@/lib/phoneVerification';

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
    const [country, setCountry] = useState<CountryCode>(() => defaultPhoneCountry(
        user?.phone?.number, user?.profile?.current_location?.country, getLocales()[0]?.regionCode,
    ));
    const [number, setNumber] = useState(() => phoneInput(user?.phone?.number || '', country).number);
    const [picker, setPicker] = useState(false);
    const [consent, setConsent] = useState(false);
    const [code, setCode] = useState('');
    const [codeFocused, setCodeFocused] = useState(false);
    const codeInput = useRef<TextInput>(null);
    const [challenge, setChallenge] = useState<PhoneChallenge | null>(null);
    const [retryAt, setRetryAt] = useState(0);
    const [now, setNow] = useState(Date.now());
    const [error, setError] = useState('');
    const [completedNumber, setVerified] = useState<string | null>(null);
    const verified = completedNumber || (user?.phone?.verified ? user.phone.number : null);
    const [editing, setEditing] = useState(false);
    const textStyle = { textAlign: isRTL ? 'right' as const : 'left' as const };
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
    useEffect(() => {
        if (challenge && !busy) codeInput.current?.focus();
    }, [challenge, busy]);

    const send = async () => {
        if (locked.current || !consent || !emailVerified || resend > 0) return;
        const normalized = challenge?.number || normalizeVerificationPhone(number, country);
        if (!normalized) { setError('invalid_number'); return; }
        locked.current = true;
        setBusy(true); setError(''); setCode('');
        setRetryAt(Date.now() + 60000);
        Keyboard.dismiss();
        try {
            const result = await api.post('/verification/phone/send', { phoneNumber: normalized }, { timeout: 25000 });
            if (!alive.current) return;
            const next = readPhoneChallenge(result, normalized);
            if (next) {
                setChallenge(next); setNow(Date.now());
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

    const link = (title: string, onPress: () => void, disabled = false, centered = false) => (
        <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
            accessibilityState={{ disabled }} style={[styles.link, { opacity: disabled ? 0.45 : 1 }]}>
            <Text variant="body-sm" className="font-body-bold" style={[textStyle, { color: disabled ? colors.brand.text.muted : colors.chrome.primary }, centered && styles.center]}>{title}</Text>
        </Pressable>
    );

    return (
        <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title="" fallbackHref="/verifications" />
            <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={scale(16)}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + scale(16) }]}>
                {verified && !editing ? (
                    <View style={styles.formContent}>
                        <View style={styles.badge} accessible={false}>
                            <SealCheck size={48} color={colors.chrome.primary} weight="fill" />
                            <SealCheck size={52} color={colors.chrome.common.inverseText} weight="light" style={StyleSheet.absoluteFill} />
                        </View>
                        <Text variant="heading-sm" style={styles.center}>{copy('verified')}</Text>
                        <Text variant="body" style={[styles.center, { writingDirection: 'ltr' }]}>{parsePhoneNumberFromString(verified)?.formatInternational() || verified}</Text>
                        <GradientButton title={t('continue', 'Continue')} onPress={() => router.replace('/verifications')} size="compact" widthMode="full" />
                        {link(copy('change'), () => { setEditing(true); setConsent(false); setNumber(''); setError(''); }, false, true)}
                    </View>
                ) : !emailVerified ? (
                    <View style={styles.group}>
                        <Text variant="body-sm" style={textStyle}>{copy('email')}</Text>
                        {link(t('account_email', 'Account email'), () => router.push('/settings-account'))}
                    </View>
                ) : (
                    <View style={styles.group}>
                        {challenge ? <>
                            <View style={styles.introduction}>
                                <Text variant="heading-sm" style={styles.center}>{copy('code_title')}</Text>
                                <View>
                                <Text variant="body-sm" style={styles.center}>{copy('code_description')}</Text>
                                <View style={styles.codePhoneRow}>
                                <Text variant="body-sm" className="font-body-bold" style={[styles.center, { writingDirection: 'ltr', flexShrink: 1 }]}>
                                    {parsePhoneNumberFromString(challenge.number)?.formatInternational() || challenge.number}
                                </Text>
                                <Pressable accessibilityRole="button" accessibilityLabel={copy('change')}
                                    accessibilityState={{ disabled: busy }} disabled={busy} style={styles.editNumber}
                                    onPress={() => { setChallenge(null); setCode(''); setError(''); setConsent(false); }}>
                                    <PencilSimple size={20} color={busy ? colors.brand.text.muted : colors.chrome.primary} />
                                </Pressable>
                                </View>
                                </View>
                            </View>
                            <View style={styles.formContent}>
                            <View style={styles.codeRow}>
                                <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.digits}>
                                    {Array.from({ length: 6 }, (_, index) => (
                                        <View key={index} style={[styles.digit, { borderColor: error ? colors.brand.accent.error : codeFocused && index === Math.min(code.length, 5) ? colors.chrome.primary : colors.brand.bg.border }]}>
                                            <Text variant="body" style={styles.digitText}>{code[index] || ''}</Text>
                                        </View>
                                    ))}
                                </View>
                            <TextInput ref={codeInput} accessibilityLabel={copy('code')} value={code}
                                onChangeText={(value) => { setCode(asciiDigits(value).replace(/\D/g, '').slice(0, 6)); setError(''); }}
                                onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)}
                                keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
                                autoCorrect={false} autoFocus maxLength={32} editable={!busy && remaining > 0}
                                caretHidden selection={{ start: code.length, end: code.length }} style={styles.codeInput}
                                onSubmitEditing={verify} />
                            </View>
                            {error ? <Text accessibilityLiveRegion="polite" variant="body-sm" style={[styles.center, { color: colors.brand.accent.error }]}>{copy(error)}</Text> : null}
                            <Text variant="body-sm" style={[styles.center, styles.expiry, { color: colors.brand.text.subtitle }]}>
                                {remaining > 0 ? copy('expires', { time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` }) : copy('expired')}
                            </Text>
                            <GradientButton title={copy('verify')} onPress={verify} loading={busy} size="compact"
                                disabled={busy || code.length !== 6 || remaining === 0} widthMode="full" />
                            {link(resend > 0 ? copy('resend_in', { seconds: resend }) : copy('resend'), send, busy || resend > 0, true)}
                            </View>
                        </> : <>
                            <View style={styles.introduction}>
                                <Text variant="heading-sm" style={{ textAlign: 'center' }}>{copy('entry_title')}</Text>
                                <Text variant="body-sm" style={styles.entryDescription}>
                                    {copy('intro')}{' '}
                                    <Text variant="body-sm" className="font-body-bold" style={{ color: colors.chrome.primary }}>
                                        {copy('privacy')}
                                    </Text>
                                </Text>
                            </View>
                            <View style={styles.formContent}>
                            <View style={styles.phoneRow}>
                                <View style={{ width: 80, flexShrink: 0 }}>
                                <Pressable onPress={() => { Keyboard.dismiss(); setPicker(true); }} disabled={busy}
                                    accessibilityRole="button" accessibilityLabel={copy('country')}
                                    accessibilityValue={{ text: `${translateCountry(country)} (+${getCountryCallingCode(country)})` }}
                                    accessibilityState={{ disabled: busy, expanded: picker }}
                                    style={{ flex: 1, opacity: busy ? 0.45 : 1 }}>
                                    <View pointerEvents="none" style={{ flex: 1, minHeight: scale(52), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(8), borderBottomWidth: picker ? 1.5 : 1, borderBottomColor: picker ? colors.chrome.primary : colors.brand.bg.border }}>
                                    <Text variant="body" numberOfLines={1} style={{ color: colors.brand.text.body, writingDirection: 'ltr', fontSize: scale(16), flexShrink: 0 }}>
                                        +{getCountryCallingCode(country)}
                                    </Text>
                                    <CaretDown size={scale(16)} color={colors.brand.text.muted} style={{ flexShrink: 0 }} />
                                    </View>
                                </Pressable>
                                </View>
                                <UnderlineTextInput accessibilityLabel={copy('number')} value={number} keyboardType="number-pad"
                                    textContentType="telephoneNumber" autoComplete="tel" autoCorrect={false}
                                    onChangeText={(value) => {
                                        const next = phoneInput(value, country);
                                        setCountry(next.country); setNumber(next.number); setError('');
                                    }} editable={!busy} error={error === 'invalid_number'}
                                    style={styles.number} placeholder={copy('number')}
                                    placeholderTextColor={colors.brand.text.muted} />
                            </View>
                                <Checkbox checked={consent} onChange={setConsent} disabled={busy} label={copy('consent')} />
                            <GradientButton title={resend > 0 ? copy('resend_in', { seconds: resend }) : copy('send')}
                                onPress={send} loading={busy} disabled={busy || !consent || !number.trim() || resend > 0} widthMode="full" size="compact" />
                            </View>
                        </>}
                    </View>
                )}
                {error && !challenge ? <Text accessibilityLiveRegion="polite" variant="body-sm"
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
    introduction: { gap: scale(10) },
    entryDescription: { width: '100%', maxWidth: 304, alignSelf: 'center', textAlign: 'center' },
    formContent: { width: '100%', maxWidth: 304, alignSelf: 'center', gap: scale(16), marginTop: scale(8) },
    phoneRow: { width: '100%', flexDirection: 'row', direction: 'ltr', alignItems: 'stretch', gap: 4 },
    number: { width: 220, maxWidth: 220, flexShrink: 1, minWidth: 0, marginTop: 0, minHeight: scale(52), writingDirection: 'ltr', textAlign: 'left', fontSize: scale(16) },
    center: { textAlign: 'center' },
    codePhoneRow: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', maxWidth: '100%' },
    editNumber: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    badge: { width: 52, height: 52, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
    codeRow: { width: '100%' },
    digits: { flexDirection: 'row', direction: 'ltr', alignItems: 'flex-start', gap: 6 },
    digit: { flex: 1, aspectRatio: 1, minWidth: 0, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    expiry: { marginTop: 8 },
    digitText: { fontSize: 24, lineHeight: 32, textAlign: 'center' },
    codeInput: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: 0.02, color: 'transparent', writingDirection: 'ltr', fontSize: 24 },
    error: { marginTop: scale(16) },
});
