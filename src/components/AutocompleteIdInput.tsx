import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';
import { mobileApi, AutocompleteSuggestion } from '../services/api';

export interface AutocompleteIdInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeId: (id: string, suggestion?: AutocompleteSuggestion) => void;
  entityType?: 'all' | 'property' | 'enquiry' | 'customer';
  required?: boolean;
  helperText?: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
}

export const AutocompleteIdInput: React.FC<AutocompleteIdInputProps> = ({
  label,
  placeholder = 'Type 2-3 letters/numbers to search...',
  value,
  onChangeId,
  entityType = 'all',
  required = false,
  helperText,
  autoCapitalize = 'characters',
}) => {
  const [inputText, setInputText] = useState(value || '');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AutocompleteSuggestion | null>(null);
  const debounceRef = useRef<any>(null);

  // Sync internal state if external value changes
  useEffect(() => {
    if (value !== inputText) {
      setInputText(value || '');
      if (!value) {
        setSelectedItem(null);
      }
    }
  }, [value]);

  const fetchSuggestions = async (q: string) => {
    setLoading(true);
    try {
      const res = await mobileApi.getSuggestions(q.trim(), entityType, 8);
      setSuggestions(res.suggestions || []);
      setIsOpen((res.suggestions || []).length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    onChangeId(text);
    if (selectedItem && selectedItem.id !== text) {
      setSelectedItem(null);
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 200);
  };

  const handleSelectSuggestion = (item: AutocompleteSuggestion) => {
    setInputText(item.id);
    setSelectedItem(item);
    setIsOpen(false);
    onChangeId(item.id, item);
  };

  const handleClear = () => {
    setInputText('');
    setSelectedItem(null);
    setSuggestions([]);
    setIsOpen(false);
    onChangeId('');
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'property':
        return 'home';
      case 'enquiry':
        return 'search';
      case 'customer':
        return 'person';
      default:
        return 'pricetag';
    }
  };

  const getBadgeColor = (badge: string) => {
    const b = badge.toUpperCase();
    if (b === 'AVAILABLE' || b === 'HOT' || b === 'ACTIVE') return { bg: '#DEF7EC', text: '#03543F' };
    if (b === 'RENTED' || b === 'SOLD' || b === 'CLOSED') return { bg: '#FDE8E8', text: '#9B1C1C' };
    if (b === 'UNDER_NEGOTIATION' || b === 'WARM') return { bg: '#FEF08A', text: '#854D0E' };
    return { bg: '#EFF6FF', text: '#1D4ED8' };
  };

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label} {required && <Text style={{ color: '#DC2626' }}>*</Text>}
          </Text>
          <Text style={styles.autoHint}>Smart Autocomplete (2-3 chars)</Text>
        </View>
      )}

      {/* Input container */}
      <View style={[styles.inputBox, isOpen && styles.inputBoxOpen]}>
        <Ionicons name="search-outline" size={16} color={themeTokens.colors.primaryDark} style={{ marginRight: 6 }} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={inputText}
          onChangeText={handleTextChange}
          onFocus={() => {
            fetchSuggestions(inputText);
          }}
          autoCapitalize={autoCapitalize}
          placeholderTextColor="#9CA3AF"
        />
        {loading && <ActivityIndicator size="small" color={themeTokens.colors.primaryDark} style={{ marginRight: 4 }} />}
        {inputText.length > 0 && !loading ? (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 6 }}>
            <Ionicons name="close-circle" size={17} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => {
            if (isOpen) {
              setIsOpen(false);
            } else {
              fetchSuggestions(inputText);
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={17} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Selected Item Confirmation Card */}
      {selectedItem && (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={getEntityIcon(selectedItem.entity_type)} size={14} color="#047857" />
              <Text style={styles.selectedTitle}>{selectedItem.title}</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: getBadgeColor(selectedItem.badge).bg }]}>
              <Text style={[styles.badgeText, { color: getBadgeColor(selectedItem.badge).text }]}>
                {selectedItem.badge}
              </Text>
            </View>
          </View>
          <Text style={styles.selectedSubtitle} numberOfLines={2}>
            {selectedItem.subtitle}
          </Text>
        </View>
      )}

      {/* Floating Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownHeaderTitle}>
              MATCHING SUGGESTIONS ({suggestions.length})
            </Text>
            <TouchableOpacity onPress={() => setIsOpen(false)}>
              <Text style={styles.dropdownCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          {suggestions.map((item) => {
            const badgeColors = getBadgeColor(item.badge);
            return (
              <TouchableOpacity
                key={`${item.entity_type}-${item.id}`}
                style={styles.suggestionRow}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
              >
                <View style={styles.suggestionIconBox}>
                  <Ionicons name={getEntityIcon(item.entity_type)} size={14} color="#1D4ED8" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.suggestionTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={[styles.badgePill, { backgroundColor: badgeColors.bg }]}>
                      <Text style={[styles.badgeText, { color: badgeColors.text }]}>{item.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {helperText && !selectedItem && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    zIndex: 100,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  autoHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
    letterSpacing: 0.3,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  inputBoxOpen: {
    borderColor: '#1D4ED8',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  helperText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 3,
  },
  selectedCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  selectedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  selectedSubtitle: {
    fontSize: 11,
    color: '#047857',
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: '#1D4ED8',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 220,
    ...Platform.select({
      ios: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownHeaderTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  dropdownCloseText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionIconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: 190,
  },
  suggestionSubtitle: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  badgePill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
});
