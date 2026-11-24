import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';

interface QuickActionFABProps {
  onOpenQuickAction: (action: string) => void;
  bottomOffset?: number;
}

export const QuickActionFAB: React.FC<QuickActionFABProps> = ({
  onOpenQuickAction,
  bottomOffset = 24,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (actionKey: string) => {
    setIsOpen(false);
    onOpenQuickAction(actionKey);
  };

  return (
    <>
      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fabButton, { bottom: bottomOffset }]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.88}
        accessibilityLabel="Create New Activity"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Speed Dial Menu Modal */}
      {isOpen && (
        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.dialContainer, { bottom: bottomOffset }]}>
                {/* Option 3: + Visit */}
                <TouchableOpacity
                  style={styles.dialItemRow}
                  onPress={() => handleAction('SCHEDULE_VISIT')}
                  activeOpacity={0.85}
                >
                  <View style={styles.dialLabelBox}>
                    <Text style={styles.dialLabelText}>+ Visit</Text>
                  </View>
                  <View style={[styles.dialIconCircle, { backgroundColor: '#D97706' }]}>
                    <Ionicons name="calendar" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                {/* Option 2: + Enquiry */}
                <TouchableOpacity
                  style={styles.dialItemRow}
                  onPress={() => handleAction('ADD_ENQUIRY')}
                  activeOpacity={0.85}
                >
                  <View style={styles.dialLabelBox}>
                    <Text style={styles.dialLabelText}>+ Enquiry</Text>
                  </View>
                  <View style={[styles.dialIconCircle, { backgroundColor: '#057A55' }]}>
                    <Ionicons name="person-add" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                {/* Option 1: + Property */}
                <TouchableOpacity
                  style={styles.dialItemRow}
                  onPress={() => handleAction('ADD_PROPERTY')}
                  activeOpacity={0.85}
                >
                  <View style={styles.dialLabelBox}>
                    <Text style={styles.dialLabelText}>+ Property</Text>
                  </View>
                  <View style={[styles.dialIconCircle, { backgroundColor: themeTokens.colors.primaryDark }]}>
                    <Ionicons name="home" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                {/* Close Button at bottom in place of FAB */}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setIsOpen(false)}
                  activeOpacity={0.88}
                >
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  fabButton: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: themeTokens.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 0,
    elevation: 0,
    zIndex: 99,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  dialContainer: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: 14,
  },
  dialItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dialLabelBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 0,
  },
  dialLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: themeTokens.colors.textPrimary,
  },
  dialIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 0,
    elevation: 0,
  },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 0,
    elevation: 0,
  },
});
