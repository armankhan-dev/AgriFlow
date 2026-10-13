package com.agriflow.farm;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Entity
@Table(name = "farms")
public class Farm {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    private String name;

    @NotBlank
    private String location;

    @NotBlank
    private String crop;

    @NotNull
    @DecimalMin("0.1")
    private Double hectares;

    @NotNull
    private Double soilMoisture;

    @NotNull
    private Double waterNeed;

    protected Farm() {
    }

    public Farm(String name, String location, String crop, Double hectares, Double soilMoisture, Double waterNeed) {
        this.name = name;
        this.location = location;
        this.crop = crop;
        this.hectares = hectares;
        this.soilMoisture = soilMoisture;
        this.waterNeed = waterNeed;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getLocation() { return location; }
    public String getCrop() { return crop; }
    public Double getHectares() { return hectares; }
    public Double getSoilMoisture() { return soilMoisture; }
    public Double getWaterNeed() { return waterNeed; }

    public void update(String name, String location, String crop, Double hectares, Double soilMoisture, Double waterNeed) {
        this.name = name;
        this.location = location;
        this.crop = crop;
        this.hectares = hectares;
        this.soilMoisture = soilMoisture;
        this.waterNeed = waterNeed;
    }
}