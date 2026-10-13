package com.agriflow.farm;

import com.agriflow.sensor.SensorReading;
import com.agriflow.sensor.SensorReadingRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class FarmController {
    private final FarmRepository farms;
    private final SensorReadingRepository readings;

    public FarmController(FarmRepository farms, SensorReadingRepository readings) {
        this.farms = farms;
        this.readings = readings;
    }

    @GetMapping("/farms")
    public List<Farm> allFarms() {
        return farms.findAll();
    }

    @PostMapping("/farms")
    public Farm createFarm(@Valid @RequestBody FarmRequest request) {
        return farms.save(request.toFarm());
    }

    @PutMapping("/farms/{id}")
    public Farm updateFarm(@PathVariable Long id, @Valid @RequestBody FarmRequest request) {
        Farm farm = farms.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        farm.update(request.name(), request.location(), request.crop(), request.hectares(),
                request.soilMoisture(), request.waterNeed());
        return farms.save(farm);
    }

    @DeleteMapping("/farms/{id}")
    @Transactional
    public void deleteFarm(@PathVariable Long id) {
        if (!farms.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        readings.deleteAllByFarm_Id(id);
        farms.deleteById(id);
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        List<Farm> all = farms.findAll();
        double hectares = all.stream().mapToDouble(Farm::getHectares).sum();
        double water = all.stream().mapToDouble(Farm::getWaterNeed).sum();
        double moisture = all.stream().mapToDouble(Farm::getSoilMoisture).average().orElse(0);
        long attention = all.stream().filter(farm -> farm.getSoilMoisture() < 30).count();
        return Map.of("farmCount", all.size(), "totalHectares", hectares, "waterDemand", water,
                "averageMoisture", moisture, "attentionCount", attention,
                "readingCount", readings.count());
    }

    @GetMapping("/sensors")
    public List<SensorView> recentReadings() {
        return readings.findTop30ByOrderByObservedAtDesc().stream()
                .map(reading -> new SensorView(reading.getId(), reading.getFarm().getId(),
                        reading.getFarm().getName(), reading.getMoisture(), reading.getTemperature(),
                        reading.getRainfall(), reading.getObservedAt()))
                .toList();
    }

    @PostMapping("/sensors")
    public SensorView recordReading(@Valid @RequestBody SensorRequest request) {
        Farm farm = farms.findById(request.farmId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Farm not found"));
        SensorReading reading = readings.save(new SensorReading(farm, request.moisture(),
                request.temperature(), request.rainfall(), Instant.now()));
        return new SensorView(reading.getId(), farm.getId(), farm.getName(), reading.getMoisture(),
                reading.getTemperature(), reading.getRainfall(), reading.getObservedAt());
    }

    public record FarmRequest(@NotBlank String name, @NotBlank String location, @NotBlank String crop,
                              @NotNull @DecimalMin("0.1") Double hectares,
                              @NotNull Double soilMoisture, @NotNull Double waterNeed) {
        Farm toFarm() { return new Farm(name, location, crop, hectares, soilMoisture, waterNeed); }
    }

    public record SensorRequest(@NotNull Long farmId, @NotNull Double moisture,
                                @NotNull Double temperature, @NotNull Double rainfall) {
    }

    public record SensorView(Long id, Long farmId, String farmName, Double moisture,
                             Double temperature, Double rainfall, Instant observedAt) {
    }
}