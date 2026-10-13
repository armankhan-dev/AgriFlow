package com.agriflow.sensor;

import com.agriflow.farm.Farm;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "sensor_readings")
public class SensorReading {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Farm farm;

    private Double moisture;
    private Double temperature;
    private Double rainfall;
    private Instant observedAt;

    protected SensorReading() {
    }

    public SensorReading(Farm farm, Double moisture, Double temperature, Double rainfall, Instant observedAt) {
        this.farm = farm;
        this.moisture = moisture;
        this.temperature = temperature;
        this.rainfall = rainfall;
        this.observedAt = observedAt;
    }

    public Long getId() { return id; }
    public Farm getFarm() { return farm; }
    public Double getMoisture() { return moisture; }
    public Double getTemperature() { return temperature; }
    public Double getRainfall() { return rainfall; }
    public Instant getObservedAt() { return observedAt; }
}