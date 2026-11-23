import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeTokens } from '../theme/tokens';

export interface DateTimePickerModalProps {
  visible: boolean;
  value?: string | Date;
  onConfirm: (date: Date, isoString: string) => void;
  onClose: () => void;
  title?: string;
  minDate?: Date;
  mode?: 'datetime' | 'date' | 'time';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const POPULAR_TIMES = [
  { label: '09:30 AM', hour: 9, minute: 30 },
  { label: '10:30 AM', hour: 10, minute: 30 },
  { label: '11:30 AM', hour: 11, minute: 30 },
  { label: '01:00 PM', hour: 13, minute: 0 },
  { label: '02:30 PM', hour: 14, minute: 30 },
  { label: '04:00 PM', hour: 16, minute: 0 },
  { label: '05:30 PM', hour: 17, minute: 30 },
  { label: '06:30 PM', hour: 18, minute: 30 },
  { label: '07:30 PM', hour: 19, minute: 30 },
];

export const DateTimePickerModal: React.FC<DateTimePickerModalProps> = ({
  visible,
  value,
  onConfirm,
  onClose,
  title = 'Select Date & Time',
  minDate = new Date(),
  mode = 'datetime',
}) => {
  // Parse initial value
  const parseInitialDate = (): Date => {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    // Default to today + 2 hours
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0);
    d.setSeconds(0);
    return d;
  };

  const [activeTab, setActiveTab] = useState<'date' | 'time'>('date');
  const [selectedDate, setSelectedDate] = useState<Date>(parseInitialDate());
  const [viewYear, setViewYear] = useState<number>(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selectedDate.getMonth());

  // Time components
  const [selectedHour, setSelectedHour] = useState<number>(
    selectedDate.getHours() % 12 || 12
  );
  const [selectedMinute, setSelectedMinute] = useState<number>(
    Math.round(selectedDate.getMinutes() / 15) * 15 % 60
  );
  const [isPM, setIsPM] = useState<boolean>(selectedDate.getHours() >= 12);

  useEffect(() => {
    if (visible) {
      const d = parseInitialDate();
      setSelectedDate(d);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelectedHour(d.getHours() % 12 || 12);
      setSelectedMinute(Math.round(d.getMinutes() / 15) * 15 % 60);
      setIsPM(d.getHours() >= 12);
      setActiveTab(mode === 'time' ? 'time' : 'date');
    }
  }, [visible, value]);

  // Calendar calculations
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const newD = new Date(selectedDate);
    newD.setFullYear(viewYear);
    newD.setMonth(viewMonth);
    newD.setDate(day);
    setSelectedDate(newD);
    if (mode === 'datetime') {
      setActiveTab('time');
    }
  };

  const applyPreset = (daysOffset: number, presetHour = 11, presetMinute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(presetHour, presetMinute, 0, 0);
    setSelectedDate(d);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedHour(presetHour % 12 || 12);
    setSelectedMinute(presetMinute);
    setIsPM(presetHour >= 12);
  };

  const handleSelectTimeSlot = (slot: { hour: number; minute: number }) => {
    setSelectedHour(slot.hour % 12 || 12);
    setSelectedMinute(slot.minute);
    setIsPM(slot.hour >= 12);

    const newD = new Date(selectedDate);
    newD.setHours(slot.hour, slot.minute, 0, 0);
    setSelectedDate(newD);
  };

  const handleConfirm = () => {
    const finalDate = new Date(selectedDate);
    let h = selectedHour % 12;
    if (isPM) h += 12;
    finalDate.setHours(h, selectedMinute, 0, 0);
    onConfirm(finalDate, finalDate.toISOString());
    onClose();
  };

  const isDaySelected = (day: number) => {
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const isDayDisabled = (day: number) => {
    if (!minDate) return false;
    const checkDate = new Date(viewYear, viewMonth, day, 23, 59, 59);
    return checkDate.getTime() < minDate.getTime();
  };

  const isToday = (day: number) => {
    const now = new Date();
    return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
  };

  const formattedDateStr = selectedDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTimeStr = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;

  // Build calendar matrix
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const dayCells: Array<{ day: number | null }> = [];

  for (let i = 0; i < startDay; i++) {
    dayCells.push({ day: null });
  }
  for (let d = 1; d <= totalDays; d++) {
    dayCells.push({ day: d });
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>Field appointment date and showing time</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Mode Switch Tabs (Date vs Time) */}
          {mode === 'datetime' && (
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'date' && styles.tabItemActive]}
                onPress={() => setActiveTab('date')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={activeTab === 'date' ? '#4F5278' : '#6B7280'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabItemText, activeTab === 'date' && styles.tabItemTextActive]}>
                  {selectedDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'time' && styles.tabItemActive]}
                onPress={() => setActiveTab('time')}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={activeTab === 'time' ? '#4F5278' : '#6B7280'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabItemText, activeTab === 'time' && styles.tabItemTextActive]}>
                  {formattedTimeStr}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {/* TAB 1: CALENDAR VIEW */}
            {activeTab === 'date' && (
              <View>
                {/* Quick Presets */}
                <View style={styles.presetsRow}>
                  <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(0, 11, 0)}>
                    <Text style={styles.presetText}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(1, 11, 0)}>
                    <Text style={styles.presetText}>Tomorrow</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(2, 16, 0)}>
                    <Text style={styles.presetText}>+2 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(7, 11, 0)}>
                    <Text style={styles.presetText}>+1 Week</Text>
                  </TouchableOpacity>
                </View>

                {/* Month & Year Navigation */}
                <View style={styles.monthNavRow}>
                  <TouchableOpacity style={styles.navArrowBtn} onPress={handlePrevMonth}>
                    <Ionicons name="chevron-back" size={18} color="#1F2937" />
                  </TouchableOpacity>
                  <Text style={styles.monthNavTitle}>
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </Text>
                  <TouchableOpacity style={styles.navArrowBtn} onPress={handleNextMonth}>
                    <Ionicons name="chevron-forward" size={18} color="#1F2937" />
                  </TouchableOpacity>
                </View>

                {/* Weekday Names */}
                <View style={styles.weekdayRow}>
                  {WEEKDAY_NAMES.map((name, idx) => (
                    <Text key={idx} style={styles.weekdayText}>
                      {name}
                    </Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {dayCells.map((item, idx) => {
                    if (item.day === null) {
                      return <View key={`blank-${idx}`} style={styles.dayCellEmpty} />;
                    }
                    const selected = isDaySelected(item.day);
                    const disabled = isDayDisabled(item.day);
                    const today = isToday(item.day);

                    return (
                      <TouchableOpacity
                        key={`day-${item.day}`}
                        style={[
                          styles.dayCell,
                          today && !selected && styles.dayCellToday,
                          selected && styles.dayCellSelected,
                          disabled && styles.dayCellDisabled,
                        ]}
                        onPress={() => !disabled && handleSelectDay(item.day!)}
                        disabled={disabled}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            today && !selected && styles.dayTextToday,
                            selected && styles.dayTextSelected,
                            disabled && styles.dayTextDisabled,
                          ]}
                        >
                          {item.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* TAB 2: TIME SELECTOR */}
            {activeTab === 'time' && (
              <View style={{ paddingVertical: 6 }}>
                {/* Popular Showing Slots */}
                <Text style={styles.sectionHeading}>POPULAR SHOWING HOURS</Text>
                <View style={styles.timeSlotsGrid}>
                  {POPULAR_TIMES.map((slot) => {
                    let h = slot.hour % 12;
                    if (h === 0) h = 12;
                    const isSlotMatch =
                      selectedHour === h &&
                      selectedMinute === slot.minute &&
                      isPM === (slot.hour >= 12);

                    return (
                      <TouchableOpacity
                        key={slot.label}
                        style={[styles.timeSlotChip, isSlotMatch && styles.timeSlotChipActive]}
                        onPress={() => handleSelectTimeSlot(slot)}
                      >
                        <Text
                          style={[
                            styles.timeSlotText,
                            isSlotMatch && styles.timeSlotTextActive,
                          ]}
                        >
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Interactive Stepper / Dial */}
                <Text style={[styles.sectionHeading, { marginTop: 14 }]}>CUSTOM TIME CLOCK</Text>
                <View style={styles.customTimeBox}>
                  {/* Hours */}
                  <View style={styles.timeComponentBox}>
                    <Text style={styles.timeComponentLabel}>HOUR</Text>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => setSelectedHour((prev) => (prev <= 1 ? 12 : prev - 1))}
                      >
                        <Ionicons name="remove" size={16} color="#4F5278" />
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{selectedHour.toString().padStart(2, '0')}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => setSelectedHour((prev) => (prev >= 12 ? 1 : prev + 1))}
                      >
                        <Ionicons name="add" size={16} color="#4F5278" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.timeColon}>:</Text>

                  {/* Minutes */}
                  <View style={styles.timeComponentBox}>
                    <Text style={styles.timeComponentLabel}>MINUTE</Text>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => setSelectedMinute((prev) => (prev <= 0 ? 45 : prev - 15))}
                      >
                        <Ionicons name="remove" size={16} color="#4F5278" />
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{selectedMinute.toString().padStart(2, '0')}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => setSelectedMinute((prev) => (prev >= 45 ? 0 : prev + 15))}
                      >
                        <Ionicons name="add" size={16} color="#4F5278" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* AM/PM Switcher */}
                  <View style={styles.ampmBox}>
                    <TouchableOpacity
                      style={[styles.ampmBtn, !isPM && styles.ampmBtnActive]}
                      onPress={() => setIsPM(false)}
                    >
                      <Text style={[styles.ampmBtnText, !isPM && styles.ampmBtnTextActive]}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ampmBtn, isPM && styles.ampmBtnActive]}
                      onPress={() => setIsPM(true)}
                    >
                      <Text style={[styles.ampmBtnText, isPM && styles.ampmBtnTextActive]}>PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Live Preview Summary Bar */}
          <View style={styles.previewBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <Text style={styles.previewText}>
                {formattedDateStr} • {formattedTimeStr}
              </Text>
            </View>
          </View>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Ionicons name="calendar-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmBtnText}>Confirm Selection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export interface DateTimePickerFieldProps {
  label?: string;
  value: string;
  onChangeValue: (isoString: string) => void;
  placeholder?: string;
  minDate?: Date;
  helperText?: string;
  required?: boolean;
  mode?: 'datetime' | 'date' | 'time';
}

export const DateTimePickerField: React.FC<DateTimePickerFieldProps> = ({
  label,
  value,
  onChangeValue,
  placeholder = 'Tap to select from calendar & clock...',
  minDate = new Date(),
  helperText,
  required = false,
  mode = 'datetime',
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  let displayLabel = '';
  if (value && value.trim()) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      if (mode === 'date') {
        displayLabel = d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      } else if (mode === 'time') {
        displayLabel = d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        });
      } else {
        const datePart = d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const timePart = d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        displayLabel = `${datePart} at ${timePart}`;
      }
    }
  }

  return (
    <View style={styles.fieldContainer}>
      {label && (
        <Text style={styles.fieldLabel}>
          {label} {required && <Text style={{ color: '#EF4444' }}>*</Text>}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.inputBox, displayLabel ? styles.inputBoxFilled : null]}
        onPress={() => setModalOpen(true)}
        activeOpacity={0.8}
      >
        <Ionicons
          name="calendar"
          size={18}
          color={displayLabel ? '#4F5278' : '#9CA3AF'}
          style={{ marginRight: 8 }}
        />
        <Text style={[styles.inputText, !displayLabel && styles.placeholderText]}>
          {displayLabel || placeholder}
        </Text>

        {displayLabel ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onChangeValue('');
            }}
            style={{ padding: 4 }}
          >
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
        )}
      </TouchableOpacity>

      {helperText && <Text style={styles.helperText}>{helperText}</Text>}

      <DateTimePickerModal
        visible={modalOpen}
        value={value}
        minDate={minDate}
        mode={mode}
        onConfirm={(_, isoString) => onChangeValue(isoString)}
        onClose={() => setModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabItemTextActive: {
    color: '#4F5278',
    fontWeight: '800',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#EEF0F8',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F5278',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  weekdayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCellEmpty: {
    width: 38,
    height: 38,
    marginVertical: 2,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#4F5278',
  },
  dayCellSelected: {
    backgroundColor: '#4F5278',
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  dayTextToday: {
    color: '#4F5278',
    fontWeight: '800',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextDisabled: {
    color: '#9CA3AF',
  },
  sectionHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeSlotChip: {
    width: '31%',
    backgroundColor: '#F3F4F6',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeSlotChipActive: {
    backgroundColor: '#EEF0F8',
    borderColor: '#4F5278',
  },
  timeSlotText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  timeSlotTextActive: {
    color: '#4F5278',
    fontWeight: '800',
  },
  customTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  timeComponentBox: {
    alignItems: 'center',
  },
  timeComponentLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 2,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepperVal: {
    width: 32,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  timeColon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#4F5278',
    marginTop: 12,
  },
  ampmBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 2,
    marginTop: 12,
  },
  ampmBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ampmBtnActive: {
    backgroundColor: '#4F5278',
  },
  ampmBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  ampmBtnTextActive: {
    color: '#FFFFFF',
  },
  previewBar: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  previewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#4F5278',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Field Styles
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  inputBoxFilled: {
    borderColor: '#4F5278',
    backgroundColor: '#FAF5FF',
  },
  inputText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  helperText: {
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 4,
  },
});
