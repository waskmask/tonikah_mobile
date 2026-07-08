import React from "react";
import { Modal as RNModal, View, TouchableOpacity, ScrollView } from "react-native";
import { Text } from "./Text";
import { scale } from "@/hooks/useResponsive";
import { X } from "lucide-react-native";

interface ModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ visible, onClose, title, children }) => {
    return (
        <RNModal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-end">
                <TouchableOpacity
                    className="absolute inset-0"
                    onPress={onClose}
                    activeOpacity={1}
                />

                <View className="bg-white dark:bg-brand-bg-surface rounded-t-[32px] max-h-[90%] pb-10">
                    <View className="flex-row items-center justify-between px-6 py-5 border-b border-brand-bg-border">
                        <Text variant="h3">{title}</Text>
                        <TouchableOpacity onPress={onClose} className="p-1">
                            <X size={scale(24)} stroke="#A99C8D" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        className="px-6 py-4"
                        showsVerticalScrollIndicator={false}
                    >
                        {children}
                    </ScrollView>
                </View>
            </View>
        </RNModal>
    );
};
