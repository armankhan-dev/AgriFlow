package com.agriflow.sensor;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SensorReadingRepository extends JpaRepository<SensorReading, Long> {
    List<SensorReading> findTop30ByOrderByObservedAtDesc();
    void deleteAllByFarm_Id(Long farmId);
}