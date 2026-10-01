import { useWindowDimensions } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { AppMenuDrawerContent } from '@/components/app/AppMenuDrawer';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { completeInteraction } from '@/lib/performanceDiagnostics';

export default function TabsDrawerLayout() {
    const { width } = useWindowDimensions();
    const { isRTL, t } = useLanguage();
    const { isDark } = useTheme();
    const drawerWidth = Math.min(width * 0.86, 360);

    return (
        <Drawer
            backBehavior="history"
            drawerContent={({ navigation }) => (
                <AppMenuDrawerContent onClose={() => navigation.closeDrawer()} />
            )}
            screenListeners={{
                transitionEnd: (event) => {
                    if (!event.data.closing) completeInteraction('drawer', 'visible');
                },
            }}
            screenOptions={{
                headerShown: false,
                drawerPosition: isRTL ? 'left' : 'right',
                drawerType: 'front',
                drawerStyle: {
                    width: drawerWidth,
                    backgroundColor: 'transparent',
                },
                overlayColor: isDark ? 'rgba(0,0,0,0.58)' : 'rgba(16,16,17,0.45)',
                swipeEnabled: true,
                swipeEdgeWidth: 28,
                swipeMinDistance: 24,
            }}
        >
            <Drawer.Screen
                name="(main)"
                options={{
                    title: String(t('menu') || 'Menu'),
                    drawerItemStyle: { display: 'none' },
                }}
            />
        </Drawer>
    );
}
