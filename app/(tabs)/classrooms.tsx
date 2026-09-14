import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ClassroomCard } from '../../components/ClassroomCard';
import { useApp } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

type FilterType = 'All' | 'Occupied' | 'Vacant' | 'Offline';

export default function ClassroomsScreen() {
  const { classrooms } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [isSearching, setIsSearching] = useState(false);

  const filteredClassrooms = classrooms.filter(cls => {
    // Text search
    const matchesSearch = cls.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cls.number.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    let matchesFilter = true;
    if (activeFilter === 'Occupied') matchesFilter = cls.occupancy === 'occupied' && cls.status === 'online';
    else if (activeFilter === 'Vacant') matchesFilter = cls.occupancy === 'vacant' && cls.status === 'online';
    else if (activeFilter === 'Offline') matchesFilter = cls.status === 'offline';

    return matchesSearch && matchesFilter;
  });

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title="Classrooms" 
        rightElement={
          <TouchableOpacity onPress={() => setIsSearching(!isSearching)}>
            <Ionicons name="search" size={24} color={Colors.text} />
          </TouchableOpacity>
        }
      />

      {isSearching && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search classrooms..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {(['All', 'Occupied', 'Vacant', 'Offline'] as FilterType[]).map(filter => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                activeFilter === filter && styles.filterChipActive
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[
                styles.filterText,
                activeFilter === filter && styles.filterTextActive
              ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      >
        {filteredClassrooms.length > 0 ? (
          filteredClassrooms.map(cls => (
            <ClassroomCard key={cls.id} classroom={cls} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color={Colors.surfaceTranslucent} />
            <Text style={styles.emptyTitle}>No classrooms found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filters.</Text>
          </View>
        )}
        
        {/* Bottom padding for floating nav */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    paddingHorizontal: Layout.spacing.md,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Layout.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    marginLeft: 8,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filtersScroll: {
    paddingHorizontal: Layout.spacing.md,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Layout.radius.round,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.surfaceTranslucent,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#000',
  },
  listContainer: {
    paddingHorizontal: Layout.spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
