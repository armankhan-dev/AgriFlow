package com.agriflow.dsa;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dsa")
public class DsaController {
    private final DsaService dsa;

    public DsaController(DsaService dsa) {
        this.dsa = dsa;
    }

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam String text, @RequestParam String query,
                                      @RequestParam(defaultValue = "KMP") String algorithm) {
        return dsa.search(text, query, algorithm);
    }

    @GetMapping("/compare")
    public Map<String, Object> compare(@RequestParam String left, @RequestParam String right) {
        return dsa.compare(left, right);
    }

    @PostMapping("/water-flow")
    public Map<String, Object> waterFlow(@Valid @RequestBody FlowRequest request) {
        return dsa.waterFlow(request.nodes(), request.edges(), request.source(), request.sink());
    }

    @PostMapping("/reservoir-sample")
    public Map<String, Object> sample(@Valid @RequestBody SampleRequest request) {
        return Map.of("sample", dsa.reservoirSample(request.stream(), request.size()),
                "streamSize", request.stream().size());
    }

    public record FlowRequest(@NotNull Integer nodes, @NotNull Integer source, @NotNull Integer sink,
                              @NotNull List<DsaService.Edge> edges) {
    }

    public record SampleRequest(@NotNull List<Integer> stream, @NotNull Integer size) {
    }
}