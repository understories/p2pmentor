/**
 * Availability CRUD helpers
 * 
 * Handles availability entities for user time blocks.
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/examples/basic/create-profile.ts
 * 
 * Supports both legacy text format and new structured WeeklyAvailability format.
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";

/**
 * Day of week (lowercase for consistency)
 */
export type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

/**
 * Time slot (HH:mm format, 24-hour)
 */
export type TimeSlot = {
  start: string; // HH:mm format (e.g., "09:00")
  end: string;   // HH:mm format (e.g., "17:00")
};

/**
 * Day availability configuration
 */
export type DayAvailability = {
  available: boolean;
  timeSlots: TimeSlot[];
};

/**
 * Structured weekly availability (Calendly-style)
 * 
 * Version 1.0 schema for standardized availability data.
 * Stored as JSON string in Arkiv entity payload.
 */
export type WeeklyAvailability = {
  version: '1.0';
  timezone: string; // IANA timezone (e.g., "America/New_York")
  days: {
    [K in DayOfWeek]: DayAvailability;
  };
  // Optional: Override dates for one-off changes (future feature)
  overrides?: Array<{
    date: string; // ISO date (YYYY-MM-DD)
    available: boolean;
    timeSlots: TimeSlot[];
  }>;
};

/**
 * Legacy availability format (backward compatibility)
 */
export type LegacyAvailability = string; // Simple text (e.g., "Mon-Fri 9am-5pm EST")

/**
 * Availability entity (Arkiv)
 */
export type Availability = {
  key: string;
  wallet: string;
  spaceId: string;
  createdAt: string;
  timeBlocks: string; // JSON string (WeeklyAvailability) or legacy text
  timezone: string;
  availabilityVersion?: '1.0' | 'legacy'; // Distinguish structured vs legacy
  txHash?: string;
}

/**
 * Validate time slot format (HH:mm)
 * 
 * @param time - Time string to validate
 * @returns true if valid HH:mm format
 */
export function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Validate time slot (start < end)
 * 
 * @param slot - Time slot to validate
 * @returns true if valid (start < end)
 */
export function isValidTimeSlot(slot: TimeSlot): boolean {
  if (!isValidTimeFormat(slot.start) || !isValidTimeFormat(slot.end)) {
    return false;
  }
  return slot.start < slot.end;
}

/**
 * Validate weekly availability structure
 * 
 * @param availability - WeeklyAvailability to validate
 * @returns Validation result with error message if invalid
 */
export function validateWeeklyAvailability(
  availability: WeeklyAvailability
): { valid: boolean; error?: string } {
  // Check version
  if (availability.version !== '1.0') {
    return { valid: false, error: 'Invalid version. Expected "1.0"' };
  }

  // Check timezone (basic IANA format check)
  if (!availability.timezone || availability.timezone.trim() === '') {
    return { valid: false, error: 'Timezone is required' };
  }

  // Check all days are present
  const requiredDays: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (const day of requiredDays) {
    if (!availability.days[day]) {
      return { valid: false, error: `Missing day: ${day}` };
    }

    const dayAvail = availability.days[day];
    
    // If available, must have at least one time slot
    if (dayAvail.available && (!dayAvail.timeSlots || dayAvail.timeSlots.length === 0)) {
      return { valid: false, error: `${day} is marked available but has no time slots` };
    }

    // If not available, should have no time slots
    if (!dayAvail.available && dayAvail.timeSlots && dayAvail.timeSlots.length > 0) {
      return { valid: false, error: `${day} is marked unavailable but has time slots` };
    }

    // Validate all time slots
    if (dayAvail.timeSlots) {
      for (let i = 0; i < dayAvail.timeSlots.length; i++) {
        const slot = dayAvail.timeSlots[i];
        if (!isValidTimeSlot(slot)) {
          return { valid: false, error: `${day} time slot ${i + 1} is invalid (start must be before end, format: HH:mm)` };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Serialize WeeklyAvailability to JSON string for Arkiv storage
 * 
 * @param availability - WeeklyAvailability to serialize
 * @returns JSON string
 */
export function serializeWeeklyAvailability(availability: WeeklyAvailability): string {
  return JSON.stringify(availability);
}

/**
 * Deserialize JSON string to WeeklyAvailability
 * 
 * @param jsonString - JSON string from Arkiv entity
 * @returns WeeklyAvailability or null if invalid
 */
export function deserializeWeeklyAvailability(jsonString: string): WeeklyAvailability | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.version === '1.0' && parsed.days && parsed.timezone) {
      const validation = validateWeeklyAvailability(parsed);
      if (validation.valid) {
        return parsed as WeeklyAvailability;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if timeBlocks string is structured format or legacy text
 * 
 * @param timeBlocks - Time blocks string from Arkiv entity
 * @returns true if structured format, false if legacy text
 */
export function isStructuredAvailability(timeBlocks: string): boolean {
  try {
    const parsed = JSON.parse(timeBlocks);
    return parsed.version === '1.0' && parsed.days && parsed.timezone;
  } catch {
    return false;
  }
}

/**
 * Create default weekly availability (all days unavailable)
 * 
 * @param timezone - IANA timezone
 * @returns Default WeeklyAvailability
 */
export function createDefaultWeeklyAvailability(timezone: string): WeeklyAvailability {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const defaultDays: { [K in DayOfWeek]: DayAvailability } = {} as any;
  
  for (const day of days) {
    defaultDays[day] = {
      available: false,
      timeSlots: [],
    };
  }

  return {
    version: '1.0',
    timezone,
    days: defaultDays,
  };
}

/**
 * Format weekly availability for human-readable display
 * 
 * Examples:
 * - "Mon-Fri 9am-5pm EST" (if uniform weekdays)
 * - "Mon, Wed, Fri 10am-2pm EST" (if specific days)
 * - "Mon-Fri 9am-12pm, 2pm-5pm EST" (if multiple slots)
 * - "No availability set" (if no days available)
 * 
 * @param availability - WeeklyAvailability to format
 * @returns Human-readable string
 */
export function formatWeeklyAvailabilityForDisplay(availability: WeeklyAvailability): string {
  const { days, timezone } = availability;
  
  // Check if all weekdays have the same slots
  const weekdaySlots = days.monday.timeSlots;
  const isUniformWeekdays = 
    days.monday.available === days.tuesday.available &&
    days.tuesday.available === days.wednesday.available &&
    days.wednesday.available === days.thursday.available &&
    days.thursday.available === days.friday.available &&
    JSON.stringify(days.monday.timeSlots) === JSON.stringify(days.tuesday.timeSlots) &&
    JSON.stringify(days.tuesday.timeSlots) === JSON.stringify(days.wednesday.timeSlots) &&
    JSON.stringify(days.wednesday.timeSlots) === JSON.stringify(days.thursday.timeSlots) &&
    JSON.stringify(days.thursday.timeSlots) === JSON.stringify(days.friday.timeSlots);

  // Format time slot (convert 24h to 12h)
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes}${ampm}`;
  };

  const formatSlot = (slot: TimeSlot): string => {
    return `${formatTime(slot.start)}-${formatTime(slot.end)}`;
  };

  // If uniform weekdays, show "Mon-Fri"
  if (isUniformWeekdays && days.monday.available && weekdaySlots.length > 0) {
    const slotsStr = weekdaySlots.map(formatSlot).join(', ');
    const tzAbbr = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
    return `Mon-Fri ${slotsStr} ${tzAbbr}`;
  }

  // Otherwise, list available days
  const availableDays: string[] = [];
  const dayLabels: Record<DayOfWeek, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  };

  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as DayOfWeek[]) {
    if (days[day].available && days[day].timeSlots.length > 0) {
      const slotsStr = days[day].timeSlots.map(formatSlot).join(', ');
      availableDays.push(`${dayLabels[day]} ${slotsStr}`);
    }
  }

  if (availableDays.length === 0) {
    return 'No availability set';
  }

  const tzAbbr = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
  return `${availableDays.join(', ')} ${tzAbbr}`;
}

/**
 * Format any availability (structured or legacy) for display
 * 
 * This is a convenience function that handles both structured WeeklyAvailability
 * and legacy text format, automatically detecting and formatting appropriately.
 * Use this when displaying availability from offers, profiles, or availability entities.
 * 
 * @param availabilityString - Availability string (JSON or plain text)
 * @returns Human-readable formatted string
 */
export function formatAvailabilityForDisplay(availabilityString: string): string {
  if (!availabilityString || availabilityString.trim() === '') {
    return 'No availability set';
  }

  // Try to parse as structured format
  const structured = deserializeWeeklyAvailability(availabilityString);
  if (structured) {
    return formatWeeklyAvailabilityForDisplay(structured);
  }

  // Fallback to plain text (legacy format)
  return availabilityString;
}

/**
 * Check if a date and time matches availability
 * 
 * Validates if a requested meeting time falls within the mentor's availability.
 * 
 * @param dateTime - ISO date-time string (e.g., "2025-12-18T13:07:00")
 * @param availabilityString - Availability string (JSON or text)
 * @returns Validation result with error message if invalid
 */
export function validateDateTimeAgainstAvailability(
  dateTime: string,
  availabilityString: string
): { valid: boolean; error?: string } {
  try {
    const requestedDate = new Date(dateTime);
    const dayOfWeek = requestedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    // Extract time in HH:mm format
    const timeStr = dateTime.split('T')[1]?.split('.')[0]?.substring(0, 5) || '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const timeMinutes = hours * 60 + minutes;
    
    // Try to parse as structured format
    const structured = deserializeWeeklyAvailability(availabilityString);
    if (structured) {
      const dayAvailability = structured.days[dayName];
      
      // Check if day is available
      if (!dayAvailability.available) {
        return { 
          valid: false, 
          error: `The selected date (${dayName}) is not available. ${formatAvailabilityForDisplay(availabilityString)}` 
        };
      }
      
      // Check if time falls within any time slot
      const timeInSlot = dayAvailability.timeSlots.some(slot => {
        const [startHours, startMinutes] = slot.start.split(':').map(Number);
        const [endHours, endMinutes] = slot.end.split(':').map(Number);
        const startTimeMinutes = startHours * 60 + startMinutes;
        const endTimeMinutes = endHours * 60 + endMinutes;
        
        return timeMinutes >= startTimeMinutes && timeMinutes < endTimeMinutes;
      });
      
      if (!timeInSlot) {
        return { 
          valid: false, 
          error: `The selected time (${timeStr}) is not within available time slots. ${formatAvailabilityForDisplay(availabilityString)}` 
        };
      }
      
      return { valid: true };
    }
    
    // For legacy text format, we can't validate precisely, so allow it
    // (This is a limitation of text-based availability)
    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'Invalid date/time format' };
  }
}

/**
 * Create an availability entity
 * 
 * Supports both legacy text format and new structured WeeklyAvailability format.
 * 
 * @param data - Availability data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function createAvailability({
  wallet,
  timeBlocks,
  timezone,
  privateKey,
  spaceId = 'local-dev',
}: {
  wallet: string;
  timeBlocks: string | WeeklyAvailability; // Time blocks description (legacy text) or WeeklyAvailability object
  timezone: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  // Use 30 days expiration (like mentor-graph example)
  const expiresIn = 2592000; // 30 days in seconds

  // Determine if structured or legacy format
  let timeBlocksString: string;
  let availabilityVersion: '1.0' | 'legacy';
  
  if (typeof timeBlocks === 'object' && timeBlocks.version === '1.0') {
    // Structured format: validate and serialize
    const validation = validateWeeklyAvailability(timeBlocks);
    if (!validation.valid) {
      throw new Error(`Invalid weekly availability: ${validation.error}`);
    }
    timeBlocksString = serializeWeeklyAvailability(timeBlocks);
    availabilityVersion = '1.0';
  } else {
    // Legacy text format
    timeBlocksString = typeof timeBlocks === 'string' ? timeBlocks : JSON.stringify(timeBlocks);
    availabilityVersion = 'legacy';
  }

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        timeBlocks: timeBlocksString,
        timezone,
        createdAt,
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'availability' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
        { key: 'timezone', value: timezone },
        { key: 'availabilityVersion', value: availabilityVersion },
      ],
      expiresIn: expiresIn,
    });
  });

  const { entityKey, txHash } = result;

  // Create separate txhash entity (like mentor-graph pattern)
  // Don't wait for this one - it's optional metadata
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      txHash,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'availability_txhash' },
      { key: 'availabilityKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn: expiresIn,
  });

  return { key: entityKey, txHash };
}

/**
 * List all availability entities for a wallet
 * 
 * @param wallet - Wallet address
 * @param spaceId - Optional space ID filter
 * @returns Array of availability entities
 */
export async function listAvailabilityForWallet(
  wallet: string,
  spaceId?: string
): Promise<Availability[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  let queryBuilder = query
    .where(eq('type', 'availability'))
    .where(eq('wallet', wallet.toLowerCase()));

  if (spaceId) {
    queryBuilder = queryBuilder.where(eq('spaceId', spaceId));
  }

  const [result, txHashResult] = await Promise.all([
    queryBuilder.withAttributes(true).withPayload(true).limit(100).fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'availability_txhash'))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
  ]);

  // Build txHash map
  const txHashMap: Record<string, string> = {};
  txHashResult.entities.forEach((entity: any) => {
    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };
    const availabilityKey = getAttr('availabilityKey');
    if (availabilityKey) {
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('Error decoding txHash payload:', e);
      }
      if (payload.txHash) {
        txHashMap[availabilityKey] = payload.txHash;
      }
    }
  });

  return result.entities.map((entity: any) => {
    let payload: any = {};
    try {
      if (entity.payload) {
        const decoded = entity.payload instanceof Uint8Array
          ? new TextDecoder().decode(entity.payload)
          : typeof entity.payload === 'string'
          ? entity.payload
          : JSON.stringify(entity.payload);
        payload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('Error decoding payload:', e);
    }

    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    const availabilityVersion = getAttr('availabilityVersion') || 'legacy';
    
    return {
      key: entity.key,
      wallet: getAttr('wallet'),
      spaceId: getAttr('spaceId') || 'local-dev',
      createdAt: getAttr('createdAt'),
      timeBlocks: payload.timeBlocks || '',
      timezone: payload.timezone || getAttr('timezone') || '',
      availabilityVersion: (availabilityVersion === '1.0' ? '1.0' : 'legacy') as '1.0' | 'legacy',
      txHash: txHashMap[entity.key],
    };
  }).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get a single availability entity by key
 *
 * @param key - Availability entity key
 * @returns Availability or null if not found
 */
export async function getAvailabilityByKey(key: string): Promise<Availability | null> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const result = await query
    .where(eq('type', 'availability'))
    .where(eq('key', key))
    .withAttributes(true)
    .withPayload(true)
    .limit(1)
    .fetch();

  if (result.entities.length === 0) return null;

  const entity = result.entities[0];
  let payload: any = {};
  try {
    if (entity.payload) {
      const decoded = entity.payload instanceof Uint8Array
        ? new TextDecoder().decode(entity.payload)
        : typeof entity.payload === 'string'
        ? entity.payload
        : JSON.stringify(entity.payload);
      payload = JSON.parse(decoded);
    }
  } catch (e) {
    console.error('Error decoding payload:', e);
  }

  const attrs = entity.attributes || {};
  const getAttr = (key: string): string => {
    if (Array.isArray(attrs)) {
      const attr = attrs.find((a: any) => a.key === key);
      return String(attr?.value || '');
    }
    return String(attrs[key] || '');
  };

  const availabilityVersion = getAttr('availabilityVersion') || 'legacy';

  return {
    key: entity.key,
    wallet: getAttr('wallet'),
    spaceId: getAttr('spaceId') || 'local-dev',
    createdAt: getAttr('createdAt'),
    timeBlocks: payload.timeBlocks || '',
    timezone: payload.timezone || getAttr('timezone') || '',
    availabilityVersion: (availabilityVersion === '1.0' ? '1.0' : 'legacy') as '1.0' | 'legacy',
    txHash: undefined, // txHash lookup can be added if needed
  };
}
